// Instagram API OAuth — Exchange code for long-lived token
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code, redirect_uri } = req.body;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) return res.status(500).json({ error: 'Instagram app credentials not configured' });

    // Step 1: Exchange code for short-lived token
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error_message) return res.status(400).json({ error: tokenData.error_message });

    const shortToken = tokenData.access_token;
    const igUserId = tokenData.user_id;

    // Step 2: Exchange for long-lived token (60 days)
    const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`);
    const longData = await longRes.json();
    if (longData.error) return res.status(400).json({ error: longData.error.message });

    // Step 3: Get profile info
    const profileRes = await fetch(`https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${longData.access_token}`);
    const profile = await profileRes.json();

    return res.status(200).json({
      access_token: longData.access_token,
      expires_in: longData.expires_in || 5184000,
      ig_user_id: String(igUserId),
      ig_username: profile.username || '',
      followers: profile.followers_count || 0,
      media_count: profile.media_count || 0,
      profile_pic: profile.profile_picture_url || '',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
