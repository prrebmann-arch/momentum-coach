const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { athleteName, athleteEmail, monthlyAmount, coachId, athleteId } = req.body;

    // Create or get customer
    const customers = await stripe.customers.list({ email: athleteEmail, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({ email: athleteEmail, name: athleteName, metadata: { coach_id: coachId, athlete_id: athleteId } });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Coaching ${athleteName}` },
          unit_amount: monthlyAmount, // in cents
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      success_url: `${req.headers.origin || 'https://pierreapp.vercel.app'}?payment=success`,
      cancel_url: `${req.headers.origin || 'https://pierreapp.vercel.app'}?payment=cancel`,
      metadata: { coach_id: coachId, athlete_id: athleteId },
    });

    return res.status(200).json({ url: session.url, customer_id: customer.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
