// Sync Instagram Profile — Followers, bio, etc.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ig_user_id, access_token } = req.body;
    if (!ig_user_id || !access_token) return res.status(400).json({ error: 'Missing params' });

    const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${access_token}`);
    const profile = await profileRes.json();

    if (profile.error) return res.status(400).json({ error: profile.error.message });

    return res.status(200).json({
      username: profile.username,
      name: profile.name,
      bio: profile.biography,
      followers: profile.followers_count,
      following: profile.follows_count,
      posts: profile.media_count,
      profile_pic: profile.profile_picture_url,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
