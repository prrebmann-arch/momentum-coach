// ===== BUSINESS — INSTAGRAM ANALYTICS =====

// ── Instagram OAuth Connect ──
function bizConnectInstagram() {
  // Instagram API app ID (from meta tag)
  const appId = document.querySelector('meta[name="meta-app-id"]')?.content;
  if (!appId) {
    notify('Instagram non configuré. Contactez le support.', 'error');
    return;
  }

  const redirectUri = encodeURIComponent(window.location.origin + '/');
  const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
  const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&enable_fb_login=0`;

  window.location.href = authUrl;
}

// Handle OAuth callback (check for ?code= in URL on page load)
async function _bizCheckIgCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);

  notify('Connexion Instagram en cours...', 'success');

  try {
    const redirectUri = window.location.origin + window.location.pathname;
    const resp = await fetch('/api/ig-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
    const data = await resp.json();
    if (data.error) { notify('Erreur: ' + data.error, 'error'); return; }

    // Save to Supabase
    const { error } = await supabaseClient.from('ig_accounts').upsert({
      user_id: currentUser.id,
      ig_user_id: data.ig_user_id,
      ig_username: data.ig_username,
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString(),
      page_id: data.page_id,
      page_access_token: data.page_access_token,
      is_connected: true,
    }, { onConflict: 'user_id' });

    if (error) { handleError(error, 'ig-connect'); return; }

    notify(`Instagram @${data.ig_username} connecté !`, 'success');

    // Auto-sync
    await bizSyncIgData();
  } catch (err) {
    notify('Erreur de connexion Instagram', 'error');
    devError('[IG Auth]', err);
  }
}

async function bizSyncIgData() {
  const { data: acct } = await supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single();
  if (!acct?.access_token) return;

  notify('Synchronisation Instagram...', 'success');

  try {
    // Sync reels client-side
    const mediaRes = await fetch(`https://graph.instagram.com/v25.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${acct.access_token}`);
    const mediaData = await mediaRes.json();
    if (!mediaData.error && mediaData.data) {
      for (const item of mediaData.data) {
        const isVideo = item.media_type === 'VIDEO' || item.media_type === 'REELS';
        // Fetch insights for videos/reels
        if (isVideo) {
          const likes = item.like_count || 0;
          const comments = item.comments_count || 0;

          // Try to fetch insights (may fail depending on token permissions)
          let reach = 0, plays = 0, saved = 0, shares = 0;
          try {
            const iRes = await fetch(`https://graph.instagram.com/v25.0/${item.id}/insights?metric=ig_reels_aggregated_all_plays_count,reach,saved,shares&access_token=${acct.access_token}`);
            const iData = await iRes.json();
            if (iData.data) {
              iData.data.forEach(m => {
                if (m.name === 'reach') reach = m.values?.[0]?.value || 0;
                if (m.name === 'saved') saved = m.values?.[0]?.value || 0;
                if (m.name === 'shares') shares = m.values?.[0]?.value || 0;
                if (m.name === 'ig_reels_aggregated_all_plays_count') plays = m.values?.[0]?.value || 0;
              });
            }
          } catch {}

          const totalEng = likes + comments + saved + shares;
          const engRate = reach > 0 ? (totalEng / reach * 100) : (likes + comments > 0 ? 1 : 0);

          await supabaseClient.from('ig_reels').upsert({
            user_id: currentUser.id,
            ig_media_id: item.id,
            caption: item.caption || null,
            thumbnail_url: item.thumbnail_url || null,
            video_url: item.media_url || null,
            views: plays || likes,
            likes,
            comments,
            shares,
            saves: saved,
            reach,
            plays,
            engagement_rate: parseFloat(engRate.toFixed(2)),
            published_at: item.timestamp,
          }, { onConflict: 'ig_media_id' });
        }
      }
    }

    // Sync active stories (last 24h only — Instagram API limitation)
    try {
      const storiesRes = await fetch(`https://graph.instagram.com/v25.0/me/stories?fields=id,media_url,thumbnail_url,caption,media_type,timestamp&access_token=${acct.access_token}`);
      const storiesData = await storiesRes.json();
      if (!storiesData.error && storiesData.data) {
        for (const story of storiesData.data) {
          let ins = {};
          try {
            const iRes = await fetch(`https://graph.instagram.com/v25.0/${story.id}/insights?metric=impressions,reach,replies,exits,taps_forward,taps_back&access_token=${acct.access_token}`);
            const iData = await iRes.json();
            (iData.data || []).forEach(m => { ins[m.name] = m.values?.[0]?.value || 0; });
          } catch {}

          await supabaseClient.from('ig_stories').upsert({
            user_id: currentUser.id,
            ig_story_id: story.id,
            ig_media_url: story.media_url || null,
            thumbnail_url: story.thumbnail_url || null,
            caption: story.caption || null,
            story_type: story.media_type === 'VIDEO' ? 'video' : 'image',
            impressions: ins.impressions || 0,
            reach: ins.reach || 0,
            replies: ins.replies || 0,
            exits: ins.exits || 0,
            taps_forward: ins.taps_forward || 0,
            taps_back: ins.taps_back || 0,
            published_at: story.timestamp,
            expires_at: new Date(new Date(story.timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'ig_story_id' });
        }
      }
    } catch {}

    notify('Instagram synchronisé !', 'success');
  } catch (err) {
    notify('Erreur de synchronisation', 'error');
    devError('[IG Sync]', err);
  }
}

// Check callback on script load
if (typeof currentUser !== 'undefined' && currentUser) {
  _bizCheckIgCallback();
} else {
  // Defer until auth is ready
  window.addEventListener('load', () => setTimeout(_bizCheckIgCallback, 2000));
}

let _bizIgTab = 'stories';
window._bizIgStories = [];
window._bizIgSequences = [];
window._bizIgSequenceItems = [];
window._bizIgReels = [];
window._bizIgPillars = [];
window._bizIgAccount = null;

const IG_SEQ_TYPES = {
  confiance:       { label: 'Confiance',       color: '#3b82f6' },
  peur:            { label: 'Peur',            color: '#ef4444' },
  preuve_sociale:  { label: 'Preuve sociale',  color: '#22c55e' },
  urgence:         { label: 'Urgence',         color: '#f97316' },
  autorité:        { label: 'Autorité',        color: '#8b5cf6' },
  storytelling:    { label: 'Storytelling',     color: '#ec4899' },
  offre:           { label: 'Offre',           color: '#eab308' },
  éducation:       { label: 'Éducation',       color: '#06b6d4' },
};

// ── Main render ──
async function bizRenderInstagram() {
  const el = document.getElementById('biz-tab-content');

  el.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:20px;">
      <button class="btn ${_bizIgTab==='stories'?'btn-red':'btn-outline'}" onclick="_bizIgTab='stories';bizRenderInstagram()"><i class="fas fa-images" style="margin-right:4px;"></i>Stories</button>
      <button class="btn ${_bizIgTab==='reels'?'btn-red':'btn-outline'}" onclick="_bizIgTab='reels';bizRenderInstagram()"><i class="fas fa-film" style="margin-right:4px;"></i>Reels</button>
      <button class="btn ${_bizIgTab==='overview'?'btn-red':'btn-outline'}" onclick="_bizIgTab='overview';bizRenderInstagram()"><i class="fas fa-chart-pie" style="margin-right:4px;"></i>Aperçu</button>
    </div>
    <div id="biz-ig-content"><div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div></div>`;

  switch (_bizIgTab) {
    case 'stories': await bizRenderIgStories(); break;
    case 'reels':   await bizRenderIgReels(); break;
    case 'overview': await bizRenderIgOverview(); break;
  }
}

// ═══════════════════════════════════════
// ── STORIES TAB ──
// ═══════════════════════════════════════

async function bizRenderIgStories() {
  const ct = document.getElementById('biz-ig-content');

  try {
    const [seqRes, storiesRes] = await Promise.all([
      supabaseClient.from('story_sequences').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabaseClient.from('ig_stories').select('*').eq('user_id', currentUser.id).order('published_at', { ascending: false }),
    ]);

    // Fetch sequence items based on user's sequences
    const seqIds = (seqRes.data || []).map(s => s.id);
    let itemsRes = { data: [] };
    if (seqIds.length) {
      itemsRes = await supabaseClient.from('story_sequence_items').select('*').in('sequence_id', seqIds);
    }

    window._bizIgSequences = seqRes.data || [];
    window._bizIgSequenceItems = itemsRes.data || [];
    window._bizIgStories = storiesRes.data || [];
  } catch (e) {
    handleError(e, 'ig-stories');
  }

  _renderIgStoriesView(ct);
}

function _renderIgStoriesView(ct) {
  if (!ct) ct = document.getElementById('biz-ig-content');
  const sequences = window._bizIgSequences || [];
  const items = window._bizIgSequenceItems || [];
  const stories = window._bizIgStories || [];

  // ── Sequences section ──
  const seqCards = sequences.map(seq => {
    const seqItems = items.filter(i => i.sequence_id === seq.id);
    const t = IG_SEQ_TYPES[seq.sequence_type] || { label: seq.sequence_type, color: '#6b7280' };
    const date = seq.created_at ? new Date(seq.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';
    return `
      <div onclick="_bizIgShowSequenceDetail('${seq.id}')" style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;cursor:pointer;transition:border-color 0.15s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-weight:600;font-size:14px;color:var(--text);">${escHtml(seq.name)}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${t.color}20;color:${t.color};font-weight:600;">${escHtml(t.label)}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:11px;color:var(--text3);">
          <span><i class="fas fa-layer-group" style="margin-right:3px;"></i>${seqItems.length} stories</span>
          <span><i class="fas fa-eye" style="margin-right:3px;"></i>${seq.total_impressions || 0}</span>
          <span><i class="fas fa-chart-line" style="margin-right:3px;"></i>${seq.overall_dropoff_rate != null ? seq.overall_dropoff_rate + '%' : '—'}</span>
          <span><i class="fas fa-reply" style="margin-right:3px;"></i>${seq.total_replies || 0}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:10px;color:var(--text3);">
          <span>${seq.status === 'active' ? '<span style="color:var(--success);"><i class="fas fa-circle" style="font-size:6px;margin-right:3px;"></i>Actif</span>' : '<span><i class="fas fa-circle" style="font-size:6px;margin-right:3px;"></i>Brouillon</span>'}</span>
          <span>${date}</span>
        </div>
      </div>`;
  }).join('');

  // ── Stories grid ──
  const storyCards = stories.map(s => {
    return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <div style="width:100%;aspect-ratio:9/16;background:var(--bg3);display:flex;align-items:center;justify-content:center;">
          ${s.thumbnail_url
            ? `<img src="${escHtml(s.thumbnail_url)}" style="width:100%;height:100%;object-fit:cover;">`
            : '<i class="fas fa-image" style="font-size:24px;color:var(--text3);opacity:0.3;"></i>'}
        </div>
        <div style="padding:10px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;color:var(--text3);">
            <span><i class="fas fa-eye" style="margin-right:2px;"></i>${s.impressions || 0}</span>
            <span><i class="fas fa-users" style="margin-right:2px;"></i>${s.reach || 0}</span>
            <span><i class="fas fa-reply" style="margin-right:2px;"></i>${s.replies || 0}</span>
            <span><i class="fas fa-sign-out-alt" style="margin-right:2px;"></i>${s.exits || 0}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  const emptyStories = `
    <div style="text-align:center;padding:40px;color:var(--text3);">
      <i class="fas fa-image" style="font-size:36px;margin-bottom:12px;display:block;opacity:0.3;"></i>
      <div style="font-size:13px;">Connectez votre Instagram pour importer vos stories</div>
    </div>`;

  ct.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0;">Story Sequences</h3>
      <button class="btn btn-red btn-sm" onclick="_bizIgCreateSequenceModal()"><i class="fas fa-plus" style="margin-right:4px;"></i>Nouvelle Séquence</button>
    </div>
    ${sequences.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:32px;">${seqCards}</div>`
      : '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;margin-bottom:32px;">Aucune séquence créée</div>'}

    <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px;">Toutes les Stories</h3>
    ${stories.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">${storyCards}</div>`
      : emptyStories}`;
}

// ── Sequence detail with funnel ──
function _bizIgShowSequenceDetail(seqId) {
  const seq = (window._bizIgSequences || []).find(s => s.id === seqId);
  if (!seq) return;

  const items = (window._bizIgSequenceItems || []).filter(i => i.sequence_id === seqId).sort((a, b) => (a.position || 0) - (b.position || 0));
  const t = IG_SEQ_TYPES[seq.sequence_type] || { label: seq.sequence_type, color: '#6b7280' };

  // Build funnel bars
  const maxImpressions = Math.max(...items.map(i => i.impressions || 0), 1);
  const funnelBars = items.map((item, idx) => {
    const pct = ((item.impressions || 0) / maxImpressions * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-size:10px;color:var(--text3);width:60px;text-align:right;">Story ${idx + 1}</span>
        <div style="flex:1;background:var(--bg3);border-radius:4px;height:24px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${t.color};border-radius:4px;display:flex;align-items:center;padding-left:8px;">
            <span style="font-size:10px;color:#fff;font-weight:600;">${item.impressions || 0}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  const ct = document.getElementById('biz-ig-content');
  ct.innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="_renderIgStoriesView()" style="margin-bottom:16px;"><i class="fas fa-arrow-left" style="margin-right:4px;"></i>Retour</button>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0;">${escHtml(seq.name)}</h3>
      <span style="font-size:11px;padding:3px 10px;border-radius:8px;background:${t.color}20;color:${t.color};font-weight:600;">${escHtml(t.label)}</span>
    </div>
    ${seq.objective ? `<div style="font-size:12px;color:var(--text3);margin-bottom:16px;"><strong>Objectif :</strong> ${escHtml(seq.objective)}</div>` : ''}
    ${seq.notes ? `<div style="font-size:12px;color:var(--text3);margin-bottom:16px;"><strong>Notes :</strong> ${escHtml(seq.notes)}</div>` : ''}

    <div style="margin-bottom:20px;">
      <div style="display:flex;gap:20px;font-size:13px;color:var(--text2);margin-bottom:16px;">
        <span><strong>${items.length}</strong> stories</span>
        <span><strong>${seq.total_impressions || 0}</strong> impressions</span>
        <span>Drop-off : <strong>${seq.overall_dropoff_rate != null ? seq.overall_dropoff_rate + '%' : '—'}</strong></span>
        <span><strong>${seq.total_replies || 0}</strong> replies</span>
      </div>
    </div>

    <h4 style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:12px;">Funnel de rétention</h4>
    ${items.length
      ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;">${funnelBars}</div>`
      : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucune story dans cette séquence</div>'}`;
}

// ── Create sequence modal ──
function _bizIgCreateSequenceModal() {
  const typeOptions = Object.entries(IG_SEQ_TYPES).map(([k, v]) =>
    `<option value="${k}">${v.label}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'ig-seq-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:420px;max-width:90vw;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 20px;">Nouvelle Séquence</h3>
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nom</label>
      <input type="text" id="ig-seq-name" class="bt-input" placeholder="Ex: Séquence confiance semaine 3" style="margin-bottom:12px;">

      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Type</label>
      <select id="ig-seq-type" class="bt-input" style="margin-bottom:12px;">${typeOptions}</select>

      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Objectif</label>
      <input type="text" id="ig-seq-objective" class="bt-input" placeholder="Ex: Générer 10 réponses DM" style="margin-bottom:12px;">

      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Notes</label>
      <textarea id="ig-seq-notes" class="bt-input" rows="3" placeholder="Notes libres..." style="margin-bottom:16px;resize:vertical;"></textarea>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-seq-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSaveSequence()">Créer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgSaveSequence() {
  const name = document.getElementById('ig-seq-name').value.trim();
  const type = document.getElementById('ig-seq-type').value;
  const objective = document.getElementById('ig-seq-objective').value.trim();
  const notes = document.getElementById('ig-seq-notes').value.trim();

  if (!name) { notify('Le nom est obligatoire', 'error'); return; }

  const { error } = await supabaseClient.from('story_sequences').insert({
    user_id: currentUser.id,
    name,
    sequence_type: type,
    objective: objective || null,
    notes: notes || null,
    status: 'draft',
  });

  if (error) { handleError(error, 'ig-create-sequence'); return; }

  document.getElementById('ig-seq-modal')?.remove();
  notify('Séquence créée', 'success');
  await bizRenderIgStories();
}

// ═══════════════════════════════════════
// ── REELS TAB ──
// ═══════════════════════════════════════

async function bizRenderIgReels() {
  const ct = document.getElementById('biz-ig-content');

  try {
    const [reelsRes, pillarsRes] = await Promise.all([
      supabaseClient.from('ig_reels').select('*').eq('user_id', currentUser.id).order('published_at', { ascending: false }),
      supabaseClient.from('ig_content_pillars').select('*').eq('user_id', currentUser.id).order('name'),
    ]);
    window._bizIgReels = reelsRes.data || [];
    window._bizIgPillars = pillarsRes.data || [];
  } catch (e) {
    handleError(e, 'ig-reels');
  }

  _renderIgReelsView(ct);
}

function _renderIgReelsView(ct) {
  if (!ct) ct = document.getElementById('biz-ig-content');
  const reels = window._bizIgReels || [];
  const pillars = window._bizIgPillars || [];

  if (!reels.length && !pillars.length) {
    ct.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <i class="fas fa-film" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block;opacity:0.4;"></i>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">Aucun reel importé</div>
        <div style="font-size:13px;color:var(--text3);">Connectez votre Instagram pour importer vos reels et analyser vos performances</div>
      </div>`;
    return;
  }

  // KPIs
  const totalViews = reels.reduce((s, r) => s + (r.views || 0), 0);
  const totalReels = reels.length;
  const avgEngagement = totalReels ? (reels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / totalReels).toFixed(2) : 0;
  const avgReach = totalReels ? Math.round(reels.reduce((s, r) => s + (r.reach || 0), 0) / totalReels) : 0;

  const kpiCard = (label, value, icon) => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
      <i class="fas ${icon}" style="font-size:18px;color:var(--primary);margin-bottom:8px;display:block;"></i>
      <div style="font-size:22px;font-weight:700;color:var(--text);">${value}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">${label}</div>
    </div>`;

  // Top performing reels table
  const sortedReels = [...reels].sort((a, b) => (b.views || 0) - (a.views || 0));
  const reelRows = sortedReels.map(r => {
    const caption = (r.caption || '').length > 50 ? escHtml(r.caption.slice(0, 50)) + '...' : escHtml(r.caption || '—');
    const pillar = pillars.find(p => p.id === r.pillar_id);
    const pillarTag = pillar
      ? `<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${escHtml(pillar.color || '#6b7280')}20;color:${escHtml(pillar.color || '#6b7280')};font-weight:600;">${escHtml(pillar.name)}</span>`
      : '<span style="color:var(--text3);font-size:10px;">—</span>';
    return `
      <tr class="nd-tr">
        <td style="font-size:12px;color:var(--text);max-width:200px;">${caption}</td>
        <td>${pillarTag}</td>
        <td style="font-size:12px;color:var(--text2);">${(r.views || 0).toLocaleString()}</td>
        <td style="font-size:12px;color:var(--text2);">${r.saves || 0}</td>
        <td style="font-size:12px;color:var(--text2);">${r.shares || 0}</td>
        <td style="font-size:12px;color:var(--text2);">${r.comments || 0}</td>
      </tr>`;
  }).join('');

  // Content pillars section
  const pillarsList = pillars.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${escHtml(p.color || '#6b7280')};"></div>
        <span style="font-size:13px;font-weight:600;color:var(--text);">${escHtml(p.name)}</span>
        <span style="font-size:11px;color:var(--text3);">${reels.filter(r => r.pillar_id === p.id).length} reels</span>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="nd2-btn nd2-btn-sm" onclick="_bizIgEditPillar('${p.id}')" title="Modifier"><i class="fas fa-pen" style="font-size:10px;"></i></button>
        <button class="nd2-btn nd2-btn-del nd2-btn-sm" onclick="_bizIgDeletePillar('${p.id}')" title="Supprimer"><i class="fas fa-trash" style="font-size:10px;"></i></button>
      </div>
    </div>`).join('');

  ct.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${kpiCard('Total Views', totalViews.toLocaleString(), 'fa-play')}
      ${kpiCard('Avg Engagement', avgEngagement + '%', 'fa-heart')}
      ${kpiCard('Total Reels', totalReels, 'fa-film')}
      ${kpiCard('Avg Reach', avgReach.toLocaleString(), 'fa-bullseye')}
    </div>

    <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">Top Performing Reels</h3>
    ${reels.length ? `
    <div class="nd-table-wrap" style="margin-bottom:28px;">
      <table class="nd-table">
        <thead><tr><th>Caption</th><th>Pillar</th><th>Views</th><th>Saves</th><th>Shares</th><th>Comments</th></tr></thead>
        <tbody>${reelRows}</tbody>
      </table>
    </div>` : ''}

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0;">Content Pillars</h3>
      <button class="btn btn-red btn-sm" onclick="_bizIgAddPillarModal()"><i class="fas fa-plus" style="margin-right:4px;"></i>Ajouter</button>
    </div>
    ${pillars.length ? pillarsList : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucun pilier de contenu défini</div>'}`;
}

// ── Pillar CRUD ──
function _bizIgAddPillarModal() {
  const overlay = document.createElement('div');
  overlay.id = 'ig-pillar-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:360px;max-width:90vw;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 20px;">Nouveau Pilier</h3>
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nom</label>
      <input type="text" id="ig-pillar-name" class="bt-input" placeholder="Ex: Éducation fitness" style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Couleur</label>
      <input type="color" id="ig-pillar-color" value="#3b82f6" style="margin-bottom:16px;width:50px;height:32px;border:none;cursor:pointer;background:transparent;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-pillar-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSavePillar()">Créer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgSavePillar(editId) {
  const name = document.getElementById('ig-pillar-name').value.trim();
  const color = document.getElementById('ig-pillar-color').value;
  if (!name) { notify('Le nom est obligatoire', 'error'); return; }

  if (editId) {
    const { error } = await supabaseClient.from('ig_content_pillars').update({ name, color }).eq('id', editId);
    if (error) { handleError(error, 'ig-pillar-edit'); return; }
    notify('Pilier mis à jour', 'success');
  } else {
    const { error } = await supabaseClient.from('ig_content_pillars').insert({ user_id: currentUser.id, name, color });
    if (error) { handleError(error, 'ig-pillar-add'); return; }
    notify('Pilier créé', 'success');
  }

  document.getElementById('ig-pillar-modal')?.remove();
  await bizRenderIgReels();
}

function _bizIgEditPillar(id) {
  const pillar = (window._bizIgPillars || []).find(p => p.id === id);
  if (!pillar) return;

  const overlay = document.createElement('div');
  overlay.id = 'ig-pillar-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:360px;max-width:90vw;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 20px;">Modifier le Pilier</h3>
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nom</label>
      <input type="text" id="ig-pillar-name" class="bt-input" value="${escHtml(pillar.name)}" style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Couleur</label>
      <input type="color" id="ig-pillar-color" value="${escHtml(pillar.color || '#3b82f6')}" style="margin-bottom:16px;width:50px;height:32px;border:none;cursor:pointer;background:transparent;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-pillar-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSavePillar('${id}')">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgDeletePillar(id) {
  if (!confirm('Supprimer ce pilier ?')) return;
  const { error } = await supabaseClient.from('ig_content_pillars').delete().eq('id', id);
  if (error) { handleError(error, 'ig-pillar-delete'); return; }
  notify('Pilier supprimé', 'success');
  await bizRenderIgReels();
}

// ═══════════════════════════════════════
// ── OVERVIEW TAB ──
// ═══════════════════════════════════════

async function bizRenderIgOverview() {
  const ct = document.getElementById('biz-ig-content');

  try {
    const { data } = await supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single();
    window._bizIgAccount = data || null;
  } catch (e) {
    window._bizIgAccount = null;
  }

  const acct = window._bizIgAccount;

  if (!acct) {
    ct.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <i class="fab fa-instagram" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block;opacity:0.4;"></i>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">Aucun compte connecté</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Connectez votre compte Instagram pour voir vos statistiques</div>
        <button class="btn btn-red" onclick="bizConnectInstagram()"><i class="fab fa-instagram" style="margin-right:6px;"></i>Connecter Instagram</button>
        <div style="font-size:11px;color:var(--text3);margin-top:12px;">Nécessite un compte Instagram Business ou Creator lié à une Page Facebook</div>
      </div>`;
    return;
  }

  // Fetch live data from Instagram API
  let profile = {};
  try {
    const resp = await fetch(`https://graph.instagram.com/v25.0/me?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${acct.access_token}`);
    profile = await resp.json();
  } catch (e) { devError('[IG Profile]', e); }

  const followers = profile.followers_count || 0;
  const following = profile.follows_count || 0;
  const posts = profile.media_count || 0;

  // Calculate engagement from reels data
  const reels = window._bizIgReels || [];
  const totalReach = reels.reduce((s, r) => s + (r.reach || 0), 0);
  const avgEngagement = reels.length ? (reels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / reels.length).toFixed(2) : '0.00';

  const kpiCard = (label, value, icon) => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;text-align:center;">
      <i class="fas ${icon}" style="font-size:20px;color:var(--primary);margin-bottom:10px;display:block;"></i>
      <div style="font-size:26px;font-weight:700;color:var(--text);">${value}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px;">${label}</div>
    </div>`;

  ct.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;overflow:hidden;">
        ${profile.profile_picture_url
          ? `<img src="${profile.profile_picture_url}" style="width:100%;height:100%;object-fit:cover;">`
          : '<i class="fab fa-instagram" style="color:#fff;font-size:22px;"></i>'}
      </div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text);">@${escHtml(acct.ig_username || profile.username || '')}</div>
        <div style="font-size:12px;color:var(--text3);">Compte connecté</div>
      </div>
      <div style="flex:1;"></div>
      <button class="btn btn-outline btn-sm" onclick="bizSyncIgData().then(()=>bizRenderInstagram())"><i class="fas fa-sync"></i> Synchroniser</button>
      <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="bizDisconnectIg()"><i class="fas fa-unlink"></i></button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
      ${kpiCard('Followers', followers.toLocaleString(), 'fa-users')}
      ${kpiCard('Following', following.toLocaleString(), 'fa-user-plus')}
      ${kpiCard('Posts', posts.toLocaleString(), 'fa-images')}
      ${kpiCard('Engagement', avgEngagement + '%', 'fa-heart')}
      ${kpiCard('Total Reach', totalReach.toLocaleString(), 'fa-bullseye')}
    </div>
    ${profile.biography ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:16px;"><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Bio</div><div style="font-size:13px;color:var(--text);white-space:pre-line;">${escHtml(profile.biography)}</div></div>` : ''}`;
}

async function bizDisconnectIg() {
  if (!confirm('Déconnecter votre compte Instagram ?')) return;
  await supabaseClient.from('ig_accounts').delete().eq('user_id', currentUser.id);
  window._bizIgAccount = null;
  notify('Instagram déconnecté', 'success');
  bizRenderInstagram();
}
