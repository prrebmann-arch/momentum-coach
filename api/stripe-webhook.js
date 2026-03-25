const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'Webhook signature failed' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      await supabase.from('stripe_customers').upsert({
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        subscription_status: 'active',
        monthly_amount: sub.items.data[0]?.price?.unit_amount || 0,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        user_id: session.metadata?.coach_id,
        athlete_id: session.metadata?.athlete_id,
      }, { onConflict: 'stripe_customer_id' });
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      await supabase.from('payment_history').insert({
        stripe_customer_id: invoice.customer,
        amount: invoice.amount_paid,
        status: 'succeeded',
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: invoice.payment_intent,
        period_start: new Date(invoice.period_start * 1000).toISOString(),
        period_end: new Date(invoice.period_end * 1000).toISOString(),
      });
      await supabase.from('stripe_customers').update({ subscription_status: 'active' }).eq('stripe_customer_id', invoice.customer);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      await supabase.from('payment_history').insert({
        stripe_customer_id: invoice.customer,
        amount: invoice.amount_due,
        status: 'failed',
        stripe_invoice_id: invoice.id,
      });
      await supabase.from('stripe_customers').update({ subscription_status: 'past_due' }).eq('stripe_customer_id', invoice.customer);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await supabase.from('stripe_customers').update({ subscription_status: 'canceled' }).eq('stripe_subscription_id', sub.id);
      break;
    }
  }

  res.status(200).json({ received: true });
};
