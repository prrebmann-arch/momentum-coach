// Instagram Webhook — Verification + receive events
module.exports = async function handler(req, res) {
  // Webhook verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === (process.env.IG_WEBHOOK_VERIFY_TOKEN || 'pierrecoaching2026')) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Receive events (POST) — just acknowledge for now
  if (req.method === 'POST') {
    return res.status(200).json({ received: true });
  }

  return res.status(405).send('Method not allowed');
};
