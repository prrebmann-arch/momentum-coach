// Instagram API OAuth via Facebook Login for Business — Exchange code for long-lived token
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code, redirect_uri } = req.body;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing code or redirect_uri' });
    }
    if (!appId || !appSecret) {
      console.error('[ig-auth] META_APP_ID or META_APP_SECRET not set in environment variables');
      return res.status(500).json({ error: 'Instagram app credentials not configured. Check Vercel env vars.' });
    }

    console.log('[ig-auth] Step 1: Exchanging code via Facebook Graph API, redirect_uri:', redirect_uri);

    // Step 1: Exchange code for short-lived token (Facebook Login for Business)
    const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[ig-auth] Step 1 failed:', JSON.stringify(tokenData.error));
      return res.status(400).json({ error: tokenData.error.message || 'Token exchange failed' });
    }

    const shortToken = tokenData.access_token;

    if (!shortToken) {
      console.error('[ig-auth] No access_token in response:', JSON.stringify(tokenData));
      return res.status(400).json({ error: 'No access token received' });
    }

    console.log('[ig-auth] Step 2: Exchanging for long-lived token');

    // Step 2: Exchange for long-lived token (60 days)
    const longRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`);
    const longData = await longRes.json();

    if (longData.error) {
      console.error('[ig-auth] Step 2 failed:', JSON.stringify(longData.error));
      return res.status(400).json({ error: longData.error.message || 'Long-lived token exchange failed' });
    }

    const longToken = longData.access_token || shortToken;

    console.log('[ig-auth] Step 3: Fetching Instagram profile');

    // Step 3: Get Instagram profile info
    const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${longToken}`);
    const profile = await profileRes.json();

    if (profile.error) {
      console.error('[ig-auth] Profile fetch failed:', JSON.stringify(profile.error));
      // Non-blocking — return token even if profile fails
    }

    const igUserId = profile.user_id || profile.id || '';

    console.log('[ig-auth] Success! Connected as @' + (profile.username || igUserId));

    return res.status(200).json({
      access_token: longToken,
      expires_in: longData.expires_in || 5184000,
      ig_user_id: String(igUserId),
      ig_username: profile.username || '',
      followers: profile.followers_count || 0,
      media_count: profile.media_count || 0,
      profile_pic: profile.profile_picture_url || '',
    });
  } catch (err) {
    console.error('[ig-auth] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
};
