// Instagram Messaging API — Send/receive messages
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, ig_user_id, recipient_id, message_text, access_token } = req.body;

    if (action === 'send') {
      // Send DM via Instagram API
      const sendRes = await fetch(`https://graph.facebook.com/v21.0/${ig_user_id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipient_id },
          message: { text: message_text },
          access_token,
        }),
      });
      const sendData = await sendRes.json();
      if (sendData.error) return res.status(400).json({ error: sendData.error.message });
      return res.status(200).json({ success: true, message_id: sendData.message_id });
    }

    if (action === 'conversations') {
      // Fetch conversations
      const convRes = await fetch(`https://graph.facebook.com/v21.0/${ig_user_id}/conversations?fields=participants,messages.limit(1){message,from,created_time}&platform=instagram&access_token=${access_token}`);
      const convData = await convRes.json();
      if (convData.error) return res.status(400).json({ error: convData.error.message });
      return res.status(200).json(convData);
    }

    if (action === 'thread') {
      const { thread_id } = req.body;
      const threadRes = await fetch(`https://graph.facebook.com/v21.0/${thread_id}?fields=messages{message,from,created_time}&access_token=${access_token}`);
      const threadData = await threadRes.json();
      if (threadData.error) return res.status(400).json({ error: threadData.error.message });
      return res.status(200).json(threadData);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
