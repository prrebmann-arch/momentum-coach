const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { subscriptionId } = req.body;
    const sub = await stripe.subscriptions.cancel(subscriptionId);
    return res.status(200).json({ status: sub.status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
