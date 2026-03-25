// ===== FORMATIONS (Pierre Coaching Protocol) =====

let currentFormationId = null;

// ── Load & render all formations ──
async function loadFormations() {
  const el = document.getElementById('formations-content');
  if (!el) return;

  const { data: formations, error } = await supabaseClient
    .from('formations')
    .select('*')
    .eq('coach_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { devError('[formations]', error); el.innerHTML = '<div class="card" style="padding:24px;color:var(--danger);">Erreur de chargement</div>'; return; }

  let html = `
    <div class="page-header">
      <h1 class="page-title">Formation</h1>
      <button class="btn btn-red" onclick="createFormation()">
        <i class="fas fa-plus"></i> Nouvelle formation
      </button>
    </div>`;

  if (!formations || !formations.length) {
    html += '<div class="card"><div class="empty-state"><i class="fas fa-graduation-cap"></i><p>Aucune formation créée</p><p style="font-size:12px;color:var(--text3);margin-top:8px;">Créez votre première formation pour commencer.</p></div></div>';
  } else {
    html += '<div class="fm-grid">';
    formations.forEach(f => {
      html += `
        <div class="fm-card" onclick="viewFormation('${f.id}')">
          <div class="fm-card-icon"><i class="fas fa-play-circle"></i></div>
          <div class="fm-card-body">
            <div class="fm-card-title">${escHtml(f.title)}</div>
            ${f.description ? `<div class="fm-card-desc">${escHtml(f.description)}</div>` : ''}
            <div class="fm-card-meta">${f.video_count || 0} vidéo${(f.video_count || 0) > 1 ? 's' : ''}</div>
          </div>
          <button class="fm-card-del" onclick="event.stopPropagation();deleteFormation('${f.id}','${escHtml(f.title)}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

// ── Create a new formation ──
async function createFormation() {
  const title = prompt('Nom de la formation :');
  if (!title || !title.trim()) return;
  const description = prompt('Description (optionnel) :') || '';

  const { error } = await supabaseClient.from('formations').insert({
    coach_id: currentUser.id,
    title: title.trim(),
    description: description.trim(),
    video_count: 0
  });

  if (error) { handleError(error, 'formations'); return; }
  loadFormations();
}

// ── Delete a formation ──
async function deleteFormation(id, title) {
  if (!confirm(`Supprimer la formation "${title}" et toutes ses vidéos ?`)) return;

  // 1. Get video IDs BEFORE deleting them
  const { data: videos } = await supabaseClient.from('formation_videos').select('id').eq('formation_id', id);
  const videoIds = (videos || []).map(v => v.id);
  // 2. Delete progress for those videos
  if (videoIds.length) await supabaseClient.from('formation_video_progress').delete().in('video_id', videoIds);
  // 3. Delete videos
  await supabaseClient.from('formation_videos').delete().eq('formation_id', id);
  // 4. Delete formation
  const { error } = await supabaseClient.from('formations').delete().eq('id', id);
  if (error) { handleError(error, 'formations'); return; }
  loadFormations();
}

// ── View formation detail (list of videos) ──
async function viewFormation(formationId) {
  currentFormationId = formationId;
  const el = document.getElementById('formations-content');

  const [fRes, vRes] = await Promise.all([
    supabaseClient.from('formations').select('*').eq('id', formationId).single(),
    supabaseClient.from('formation_videos').select('*').eq('formation_id', formationId).order('position')
  ]);

  if (fRes.error) { handleError(fRes.error, 'viewFormation'); return; }
  const formation = fRes.data;
  const videos = vRes.data || [];

  let html = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-outline" onclick="loadFormations()"><i class="fas fa-arrow-left"></i> Retour</button>
        <h1 class="page-title">${escHtml(formation.title)}</h1>
      </div>
      <button class="btn btn-red" onclick="addVideo('${formationId}')">
        <i class="fas fa-plus"></i> Ajouter une vidéo
      </button>
    </div>`;

  if (formation.description) {
    html += `<p style="color:var(--text2);margin-bottom:20px;font-size:14px;">${escHtml(formation.description)}</p>`;
  }

  if (!videos.length) {
    html += '<div class="card"><div class="empty-state"><i class="fas fa-video"></i><p>Aucune vidéo dans cette formation</p></div></div>';
  } else {
    html += '<div class="fm-videos">';
    videos.forEach((v, i) => {
      const embedUrl = getEmbedUrl(v.video_url);
      html += `
        <div class="fm-video-card">
          <div class="fm-video-num">${i + 1}</div>
          <div class="fm-video-preview">
            ${embedUrl
              ? `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
              : `<a href="${escHtml(v.video_url)}" target="_blank" class="fm-video-link"><i class="fas fa-external-link-alt"></i> Ouvrir la vidéo</a>`
            }
          </div>
          <div class="fm-video-info">
            <div class="fm-video-title">${escHtml(v.title)}</div>
          </div>
          <div class="fm-video-actions">
            <button onclick="moveVideo('${v.id}','${formationId}',${v.position},'up')" title="Monter" ${i === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up"></i></button>
            <button onclick="moveVideo('${v.id}','${formationId}',${v.position},'down')" title="Descendre" ${i === videos.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down"></i></button>
            <button onclick="deleteVideo('${v.id}','${formationId}')" title="Supprimer" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

// ── Add video to formation ──
async function addVideo(formationId) {
  const title = prompt('Titre de la vidéo :');
  if (!title || !title.trim()) return;
  const url = prompt('Lien de la vidéo (YouTube, Vimeo, Loom...) :');
  if (!url || !url.trim()) return;

  // Get next position
  const { data: existing } = await supabaseClient
    .from('formation_videos')
    .select('position')
    .eq('formation_id', formationId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 0;

  const { error } = await supabaseClient.from('formation_videos').insert({
    formation_id: formationId,
    title: title.trim(),
    video_url: url.trim(),
    position: nextPos
  });

  if (error) { handleError(error, 'formations'); return; }

  // Update video count
  await supabaseClient.from('formations').update({
    video_count: nextPos + 1
  }).eq('id', formationId);

  viewFormation(formationId);
}

// ── Delete video ──
async function deleteVideo(videoId, formationId) {
  if (!confirm('Supprimer cette vidéo ?')) return;

  await supabaseClient.from('formation_video_progress').delete().eq('video_id', videoId);
  const { error } = await supabaseClient.from('formation_videos').delete().eq('id', videoId);
  if (error) { handleError(error, 'formations'); return; }

  // Update count
  const { data: remaining } = await supabaseClient
    .from('formation_videos')
    .select('id')
    .eq('formation_id', formationId);

  await supabaseClient.from('formations').update({
    video_count: (remaining || []).length
  }).eq('id', formationId);

  viewFormation(formationId);
}

// ── Move video up/down ──
async function moveVideo(videoId, formationId, currentPos, direction) {
  const newPos = direction === 'up' ? currentPos - 1 : currentPos + 1;

  // Swap with the video at the target position
  const { data: target } = await supabaseClient
    .from('formation_videos')
    .select('id')
    .eq('formation_id', formationId)
    .eq('position', newPos)
    .single();

  if (!target) return;

  await Promise.all([
    supabaseClient.from('formation_videos').update({ position: newPos }).eq('id', videoId),
    supabaseClient.from('formation_videos').update({ position: currentPos }).eq('id', target.id)
  ]);

  viewFormation(formationId);
}

// ── Convert video URL to embeddable URL ──
function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  // Loom
  m = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (m) return `https://www.loom.com/embed/${m[1]}`;
  return null;
}
