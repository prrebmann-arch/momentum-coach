// ===== BUSINESS — 10K MRR TRACKER =====

let bizTab = 'dashboard';
let bizWeek = 1;
let bizDay = 'lundi';
let bizConfig = {};
let bizAllEntries = [];
let bizWeekEntries = [];
let bizClients = [];
let bizObjectives = {};
let bizStripeData = {};
let bizPaymentHistory = [];

const BIZ_DAYS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const BIZ_DAY_LABELS = { lundi:'L', mardi:'M', mercredi:'Me', jeudi:'J', vendredi:'V', samedi:'S' };
const BIZ_FORECAST = [
  { week:1,clients:28,mrr:3700,followers:150 },{ week:2,clients:29,mrr:3900,followers:225 },
  { week:3,clients:30,mrr:4100,followers:300 },{ week:4,clients:32,mrr:4400,followers:375 },
  { week:5,clients:34,mrr:4700,followers:450 },{ week:6,clients:36,mrr:5000,followers:525 },
  { week:7,clients:38,mrr:5400,followers:600 },{ week:8,clients:41,mrr:5800,followers:675 },
  { week:9,clients:44,mrr:6200,followers:750 },{ week:10,clients:47,mrr:6700,followers:825 },
  { week:11,clients:50,mrr:7200,followers:900 },{ week:12,clients:53,mrr:7700,followers:975 },
  { week:13,clients:56,mrr:8200,followers:1050 },{ week:14,clients:59,mrr:8800,followers:1125 },
  { week:15,clients:62,mrr:9400,followers:1200 },{ week:16,clients:67,mrr:10000,followers:1275 },
];

// ── Data layer ──
async function bizLoadConfig() {
  const { data } = await supabaseClient.from('project_config').select('*').eq('user_id', currentUser.id).single();
  return data || { week_number: 1, start_followers: 0, target_mrr: 10000, target_name: 'Objectif Business', target_deadline: null };
}
async function bizSaveConfig(updates) {
  const { error } = await supabaseClient.from('project_config').upsert({ user_id: currentUser.id, ...updates }, { onConflict: 'user_id' });
  if (error) { handleError(error, 'business'); }
}
async function bizLoadAllEntries() {
  const { data } = await supabaseClient.from('daily_entries').select('*').eq('user_id', currentUser.id);
  return data || [];
}
async function bizUpsertEntry(week, day, updates) {
  const { error } = await supabaseClient.from('daily_entries').upsert(
    { user_id: currentUser.id, week_number: week, day_name: day, ...updates },
    { onConflict: 'user_id,week_number,day_name' }
  );
  if (error) { handleError(error, 'business'); }
}
async function bizLoadObjectives(week) {
  const { data } = await supabaseClient.from('weekly_objectives').select('*').eq('user_id', currentUser.id).lte('start_week', week).order('start_week', { ascending: false }).limit(1).single();
  return data || { dms_target:200, rdvs_target:6, rdvs_attended_target:4, clients_target:2, reels_target:7, followers_target:60 };
}
async function bizSaveObjectives(startWeek, obj) {
  const { error } = await supabaseClient.from('weekly_objectives').upsert({ user_id: currentUser.id, start_week: startWeek, ...obj }, { onConflict: 'user_id,start_week' });
  if (error) { handleError(error, 'business'); }
}
async function bizLoadClients() {
  const { data } = await supabaseClient.from('biz_clients').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  return data || [];
}
async function bizAddClient(c) {
  const { error } = await supabaseClient.from('biz_clients').insert({ user_id: currentUser.id, ...c });
  if (error) { handleError(error, 'business'); }
}
async function bizUpdateClient(id, updates) {
  const { error } = await supabaseClient.from('biz_clients').update(updates).eq('id', id);
  if (error) { handleError(error, 'business'); }
}
async function bizArchiveClient(id, reason) {
  const { error } = await supabaseClient.from('biz_clients').update({ status:'archived', archived_at: new Date().toISOString(), archive_reason: reason || '' }).eq('id', id);
  if (error) { handleError(error, 'business'); }
}
async function bizDeleteClient(id) {
  const { error } = await supabaseClient.from('biz_clients').delete().eq('id', id);
  if (error) { handleError(error, 'business'); }
}
async function bizLoadStripeData() {
  const { data } = await supabaseClient.from('stripe_customers').select('*').eq('user_id', currentUser.id);
  const map = {};
  (data || []).forEach(s => { if (s.athlete_id) map[s.athlete_id] = s; });
  return map;
}
async function bizLoadPaymentHistory(stripeCustomerId) {
  const { data } = await supabaseClient.from('payment_history').select('*').eq('stripe_customer_id', stripeCustomerId).order('created_at', { ascending: false }).limit(20);
  return data || [];
}

// ── Helpers ──
function bizMRR(clients) {
  const a = (clients||[]).filter(c => c.status === 'active');
  return {
    total: a.reduce((s,c) => s + c.price, 0),
    online: a.filter(c => c.client_type === 'online').reduce((s,c) => s + c.price, 0),
    offline: a.filter(c => c.client_type === 'offline').reduce((s,c) => s + c.price, 0),
    onlineCount: a.filter(c => c.client_type === 'online').length,
    offlineCount: a.filter(c => c.client_type === 'offline').length,
    count: a.length
  };
}
function bizSum(entries, field) { return (entries||[]).reduce((s,e) => s + (Number(e[field])||0), 0); }
function bizProb(cur, target, daysLeft) {
  if (cur >= target) return 100;
  if (daysLeft <= 0) return cur >= target ? 100 : 0;
  const rem = target - cur;
  const needed = rem / daysLeft;
  const avg = target / 6;
  let p = Math.min(100, (avg / needed) * 60);
  const prog = cur / target;
  if (prog > 0.75) p = Math.min(100, p + 15);
  else if (prog > 0.5) p = Math.min(100, p + 10);
  return Math.round(Math.max(0, p));
}
function bizProbColor(p) { return p >= 70 ? 'var(--success)' : p >= 40 ? 'var(--warning)' : 'var(--danger)'; }

// ── Main load ──
async function loadBusiness() {
  const container = document.getElementById('business-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  // Auto-detect day
  const today = new Date().getDay();
  const dayMap = {1:'lundi',2:'mardi',3:'mercredi',4:'jeudi',5:'vendredi',6:'samedi'};
  if (dayMap[today]) bizDay = dayMap[today];

  await bizRefreshAll();
}

async function bizRefreshAll() {
  [bizConfig, bizAllEntries, bizClients, bizStripeData] = await Promise.all([
    bizLoadConfig(), bizLoadAllEntries(), bizLoadClients(), bizLoadStripeData()
  ]);
  bizWeek = bizConfig.week_number || 1;
  bizWeekEntries = bizAllEntries.filter(e => e.week_number === bizWeek);
  bizObjectives = await bizLoadObjectives(bizWeek);
  bizRenderAll();
}

function bizRenderAll() {
  const container = document.getElementById('business-content');
  const mrr = bizMRR(bizClients);
  const totalFollowers = (bizConfig.start_followers || 0) + bizSum(bizAllEntries, 'followers');
  const pct = Math.min(100, Math.round((mrr.total / (bizConfig.target_mrr || 10000)) * 100));

  const targetName = bizConfig.target_name || 'Objectif Business';
  const targetMrr = bizConfig.target_mrr || 10000;
  const targetDeadline = bizConfig.target_deadline;
  const weeksLeft = targetDeadline ? Math.max(0, Math.ceil((new Date(targetDeadline + 'T00:00:00') - new Date()) / (7 * MS_PER_DAY))) : null;
  const totalWeeks = targetDeadline ? Math.max(1, Math.ceil((new Date(targetDeadline + 'T00:00:00') - new Date(bizConfig.created_at || new Date())) / (7 * MS_PER_DAY))) : 16;

  let content = `
    <!-- HEADER -->
    <div class="biz-header">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;font-weight:800;color:var(--primary);letter-spacing:1px;">${escHtml(targetName)}</span>
          <button class="nd2-btn" onclick="bizEditObjective()" title="Modifier l'objectif"><i class="fas fa-pen"></i></button>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${bizStatHtml('MRR', mrr.total.toLocaleString('fr-FR') + '€', `/ ${targetMrr.toLocaleString('fr-FR')}€`)}
          ${bizStatHtml('Online', mrr.online.toLocaleString('fr-FR') + '€', `(${mrr.onlineCount})`)}
          ${bizStatHtml('Présentiel', mrr.offline.toLocaleString('fr-FR') + '€', `(${mrr.offlineCount})`)}
          ${bizStatHtml('Clients', mrr.count)}
          ${bizStatHtml('Followers', totalFollowers.toLocaleString('fr-FR'))}
          ${bizStatHtml('Semaine', bizWeek, weeksLeft !== null ? `(${weeksLeft}j restants)` : `/ ${totalWeeks}`)}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
        <div style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--success));border-radius:4px;transition:width 0.5s;"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)'};">${pct}%</span>
      </div>
    </div>

    <!-- NAV — sous-onglets Business -->
    <div style="display:flex;gap:6px;margin:16px 0;flex-wrap:wrap;">
      <button class="btn ${bizTab==='dashboard'?'btn-red':'btn-outline'}" onclick="bizSwitchTab('dashboard')"><i class="fas fa-chart-line"></i> Dashboard</button>
      <button class="btn ${bizTab==='objectives'?'btn-red':'btn-outline'}" onclick="bizSwitchTab('objectives')"><i class="fas fa-bullseye"></i> Objectifs</button>
      <button class="btn ${bizTab==='clients'?'btn-red':'btn-outline'}" onclick="bizSwitchTab('clients')"><i class="fas fa-users"></i> Clients</button>
      <button class="btn ${bizTab==='instagram'?'btn-red':'btn-outline'}" onclick="bizSwitchTab('instagram')"><i class="fab fa-instagram"></i> Instagram</button>
      <button class="btn ${bizTab==='leads'?'btn-red':'btn-outline'}" onclick="bizSwitchTab('leads')"><i class="fas fa-funnel-dollar"></i> Leads</button>
      <button class="btn ${bizTab==='messages'?'btn-red':'btn-outline'}" onclick="bizSwitchTab('messages')"><i class="fas fa-comments"></i> Messages</button>
      <button class="btn ${bizTab==='automations'?'btn-red':'btn-outline'}" onclick="bizSwitchTab('automations')"><i class="fas fa-robot"></i> Auto</button>
    </div>

    <div id="biz-tab-content"></div>
  `;

  container.innerHTML = content;

  switch (bizTab) {
    case 'dashboard': bizRenderDashboard(); break;
    case 'objectives': bizRenderObjectives(); break;
    case 'clients': bizRenderClients(); break;
    case 'instagram': if (typeof bizRenderInstagram === 'function') bizRenderInstagram(); else document.getElementById('biz-tab-content').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text3);"><i class="fab fa-instagram" style="font-size:40px;margin-bottom:12px;display:block;"></i><div style="font-size:14px;">Module Instagram — bientôt disponible</div><div style="font-size:12px;margin-top:4px;">Connectez votre compte Instagram pour commencer</div></div>'; break;
    case 'leads': if (typeof bizRenderLeads === 'function') bizRenderLeads(); else document.getElementById('biz-tab-content').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text3);"><i class="fas fa-funnel-dollar" style="font-size:40px;margin-bottom:12px;display:block;"></i><div style="font-size:14px;">CRM Leads — bientôt disponible</div></div>'; break;
    case 'messages': if (typeof bizRenderMessages === 'function') bizRenderMessages(); else document.getElementById('biz-tab-content').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text3);"><i class="fas fa-comments" style="font-size:40px;margin-bottom:12px;display:block;"></i><div style="font-size:14px;">Inbox Messages — bientôt disponible</div></div>'; break;
    case 'automations': if (typeof bizRenderAutomations === 'function') bizRenderAutomations(); else document.getElementById('biz-tab-content').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text3);"><i class="fas fa-robot" style="font-size:40px;margin-bottom:12px;display:block;"></i><div style="font-size:14px;">Automatisations — bientôt disponible</div></div>'; break;
  }
}

function bizStatHtml(label, value, sub) {
  return `<div style="display:flex;flex-direction:column;align-items:center;min-width:60px;">
    <span style="font-size:9px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;">${label}</span>
    <span style="font-size:16px;font-weight:700;">${value}</span>
    ${sub ? `<span style="font-size:10px;color:var(--text3);">${sub}</span>` : ''}
  </div>`;
}

function bizSwitchTab(tab) {
  bizTab = tab;
  bizRenderAll();
}

function bizEditObjective() {
  const c = bizConfig;
  const popup = document.createElement('div');
  popup.id = 'biz-obj-modal';
  popup.className = 'bt-popup-overlay';
  popup.onclick = e => { if (e.target === popup) popup.remove(); };
  popup.innerHTML = `
    <div class="bt-popup" style="width:420px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">Configurer l'objectif</span>
        <button class="bt-close" onclick="document.getElementById('biz-obj-modal')?.remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Nom de l'objectif</label>
          <input type="text" id="biz-obj-name" class="bt-input" value="${escHtml(c.target_name || 'Objectif Business')}" placeholder="Ex: Objectif 10K">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">MRR cible (€)</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
            ${[3000,5000,10000,15000,20000].map(v => `<button type="button" class="np-option-pill ${(c.target_mrr||10000)===v?'active':''}" onclick="document.getElementById('biz-obj-mrr').value=${v};this.parentElement.querySelectorAll('.np-option-pill').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${(v/1000)}K</button>`).join('')}
          </div>
          <input type="number" id="biz-obj-mrr" class="bt-input" value="${c.target_mrr || 10000}" placeholder="10000" style="margin-top:6px;">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Deadline</label>
          <input type="date" id="biz-obj-deadline" class="bt-input" value="${c.target_deadline || ''}">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Semaine actuelle</label>
          <input type="number" id="biz-obj-week" class="bt-input" value="${c.week_number || 1}" min="1">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Followers au démarrage</label>
          <input type="number" id="biz-obj-followers" class="bt-input" value="${c.start_followers || 0}">
        </div>
      </div>
      <div class="bt-popup-footer">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('biz-obj-modal')?.remove()">Annuler</button>
        <button class="btn btn-red" onclick="bizSaveObjectiveConfig()"><i class="fas fa-check" style="margin-right:4px;"></i>Sauvegarder</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

async function bizSaveObjectiveConfig() {
  const name = document.getElementById('biz-obj-name')?.value?.trim() || 'Objectif Business';
  const mrr = parseInt(document.getElementById('biz-obj-mrr')?.value) || 10000;
  const deadline = document.getElementById('biz-obj-deadline')?.value || null;
  const week = parseInt(document.getElementById('biz-obj-week')?.value) || 1;
  const followers = parseInt(document.getElementById('biz-obj-followers')?.value) || 0;

  await bizSaveConfig({
    target_name: name,
    target_mrr: mrr,
    target_deadline: deadline,
    week_number: week,
    start_followers: followers,
  });

  document.getElementById('biz-obj-modal')?.remove();
  notify('Objectif mis à jour !', 'success');
  await bizRefreshAll();
}

// ===== DASHBOARD =====
function bizRenderDashboard() {
  const el = document.getElementById('biz-tab-content');
  const dayEntry = bizWeekEntries.find(e => e.day_name === bizDay) || {};
  const mrr = bizMRR(bizClients);
  const totalFollowers = (bizConfig.start_followers || 0) + bizSum(bizAllEntries, 'followers');

  // Week totals
  const wDms = bizSum(bizWeekEntries,'dms'), wRdvs = bizSum(bizWeekEntries,'rdvs'),
    wRdvsA = bizSum(bizWeekEntries,'rdvs_attended'),
    wCli = bizSum(bizWeekEntries,'clients_online') + bizSum(bizWeekEntries,'clients_offline'),
    wReels = bizSum(bizWeekEntries,'reels'), wFoll = bizSum(bizWeekEntries,'followers');

  const filled = new Set(bizWeekEntries.map(e=>e.day_name)).size;
  const daysLeft = 6 - filled;

  // All-time
  const aDms = bizSum(bizAllEntries,'dms'), aRdvs = bizSum(bizAllEntries,'rdvs'),
    aRdvsA = bizSum(bizAllEntries,'rdvs_attended'),
    aCli = bizSum(bizAllEntries,'clients_online') + bizSum(bizAllEntries,'clients_offline'),
    aMeta = bizSum(bizAllEntries,'meta_ads_budget'),
    aLost = bizSum(bizAllEntries,'clients_lost_online') + bizSum(bizAllEntries,'clients_lost_offline');

  // Probs
  const pDms = bizProb(wDms,bizObjectives.dms_target,daysLeft),
    pRdvs = bizProb(wRdvs,bizObjectives.rdvs_target,daysLeft),
    pCli = bizProb(wCli,bizObjectives.clients_target,daysLeft),
    pReels = bizProb(wReels,bizObjectives.reels_target,daysLeft),
    pFoll = bizProb(wFoll,bizObjectives.followers_target,daysLeft);

  // Daily targets
  const dDms = Math.ceil(bizObjectives.dms_target/6), dReels = Math.ceil(bizObjectives.reels_target/6),
    dFoll = Math.ceil(bizObjectives.followers_target/6);

  // Dynamic forecast — linear interpolation to target
  const targetMrr = bizConfig.target_mrr || 10000;
  const totalW = bizConfig.target_deadline
    ? Math.max(1, Math.ceil((new Date(bizConfig.target_deadline + 'T00:00:00') - new Date(bizConfig.created_at || new Date())) / (7 * MS_PER_DAY)))
    : 16;
  const fcMrr = Math.round(targetMrr * (bizWeek / totalW));
  const fcClients = Math.round(fcMrr / (mrr.count > 0 ? mrr.total / mrr.count : 150));
  const fcFollowers = Math.round((bizConfig.start_followers || 0) + (bizWeek / totalW) * 1200);
  const deltaCli = mrr.count - fcClients, deltaMrr = mrr.total - fcMrr,
    deltaFoll = totalFollowers - fcFollowers;

  // KPIs
  const avgPrice = mrr.count > 0 ? Math.round(mrr.total / mrr.count) : 0;
  const dmToClient = aDms > 0 ? (aCli/aDms*100).toFixed(1)+'%' : '—';
  const cac = aCli > 0 && aMeta > 0 ? Math.round(aMeta/aCli)+'€' : '—';
  const ltv = avgPrice * 6;
  const roi = aMeta > 0 && aCli > 0 ? ((aCli*avgPrice*6/aMeta-1)*100).toFixed(0)+'%' : '—';
  const churn = aLost > 0 && aCli > 0 ? (aLost/(aCli+aLost)*100).toFixed(1)+'%' : '0%';

  // Motivation
  const mPct = mrr.total / (bizConfig.target_mrr||10000) * 100;
  const targetLabel = (bizConfig.target_mrr || 10000).toLocaleString('fr-FR') + '€';
  let mEmoji = '🔥', mText = 'Continue comme ça, tu es sur la bonne voie !';
  if (mPct >= 90) { mEmoji='🏆'; mText=`Tu y es presque ! Le ${targetLabel} est à portée de main !`; }
  else if (mPct >= 70) { mEmoji='🚀'; mText='Excellent momentum ! Chaque DM te rapproche du but.'; }
  else if (mPct >= 40) { mEmoji='💪'; mText='Tu construis ta base. La constance paie toujours.'; }
  else if (mPct < 20) { mEmoji='🌱'; mText='Chaque expert a commencé par le début. Envoie tes DMs !'; }

  el.innerHTML = `<div class="biz-grid">
    <!-- COL 1 -->
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">Aujourd'hui — S${bizWeek}</div></div>
        <div style="display:flex;gap:4px;margin-bottom:14px;">
          ${BIZ_DAYS.map(d => `<button class="biz-day-btn ${d===bizDay?'active':''}" onclick="bizSelectDay('${d}')">${BIZ_DAY_LABELS[d]}</button>`).join('')}
        </div>
        ${bizFieldRow('DMs envoyés','dms',dayEntry.dms||0,dDms)}
        ${bizFieldRow('RDVs pris','rdvs',dayEntry.rdvs||0,1)}
        ${bizFieldRow('RDVs honorés','rdvs_attended',dayEntry.rdvs_attended||0,1)}
        ${bizFieldRow('Clients online','clients_online',dayEntry.clients_online||0,'')}
        ${bizFieldRow('Clients présentiel','clients_offline',dayEntry.clients_offline||0,'')}
        ${bizFieldRow('Reels postés','reels',dayEntry.reels||0,dReels)}
        ${bizFieldRow('Followers','followers',dayEntry.followers||0,dFoll)}
        ${bizFieldRow('Meta Ads €','meta_ads_budget',dayEntry.meta_ads_budget||0,'','0.01')}
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">Cette semaine</div></div>
        ${bizWeekRow('DMs',wDms,bizObjectives.dms_target)}
        ${bizWeekRow('RDVs pris',wRdvs,bizObjectives.rdvs_target)}
        ${bizWeekRow('RDVs honorés',wRdvsA,bizObjectives.rdvs_attended_target)}
        ${bizWeekRow('Clients signés',wCli,bizObjectives.clients_target)}
        ${bizWeekRow('Reels',wReels,bizObjectives.reels_target)}
        ${bizWeekRow('Followers',wFoll,bizObjectives.followers_target)}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Tunnel de conversion</div></div>
        ${bizFunnelRow('💬','DMs envoyés',wDms,null)}
        ${bizFunnelRow('📅','RDVs pris',wRdvs,wDms>0?(wRdvs/wDms*100).toFixed(1)+'%':'—')}
        ${bizFunnelRow('✅','RDVs honorés',wRdvsA,wRdvs>0?(wRdvsA/wRdvs*100).toFixed(1)+'%':'—')}
        ${bizFunnelRow('🤝','Clients signés',wCli,wRdvsA>0?(wCli/wRdvsA*100).toFixed(1)+'%':'—')}
      </div>
    </div>

    <!-- COL 2 -->
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">Prédictions semaine</div></div>
        ${bizPredRow('DMs',pDms)}
        ${bizPredRow('RDVs',pRdvs)}
        ${bizPredRow('Clients',pCli)}
        ${bizPredRow('Reels',pReels)}
        ${bizPredRow('Followers',pFoll)}
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Projection MRR fin S${bizWeek}</div>
          <div style="font-size:22px;font-weight:800;color:var(--success);">${(mrr.total + wCli * avgPrice).toLocaleString('fr-FR')}€</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="text-align:center;padding:16px;background:rgba(179,8,8,0.06);border-radius:10px;">
          <div style="font-size:32px;margin-bottom:6px;">${mEmoji}</div>
          <div style="font-size:13px;color:var(--text);line-height:1.5;">${mText}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Semaine</div></div>
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:8px 0;">
          <button class="btn btn-outline btn-sm" onclick="bizChangeWeek(-1)" ${bizWeek<=1?'disabled':''}>← Préc.</button>
          <span style="font-size:20px;font-weight:800;">S${bizWeek}</span>
          <button class="btn btn-outline btn-sm" onclick="bizChangeWeek(1)" ${bizWeek>=16?'disabled':''}>Suiv. →</button>
        </div>
      </div>
    </div>

    <!-- COL 3 -->
    <div>
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">Métriques clés</div></div>
        ${bizMetricRow('Taux DM → Client',dmToClient)}
        ${bizMetricRow('CAC (Coût acquisition)',cac)}
        ${bizMetricRow('LTV moyen',ltv+'€')}
        ${bizMetricRow('ROI Meta Ads',roi)}
        ${bizMetricRow('Taux de churn',churn)}
        ${bizMetricRow('Prix moyen / client',avgPrice+'€/mois')}
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Prévisionnel vs Réel — S${bizWeek}</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          ${bizForecastCard('Clients',mrr.count,fc.clients,deltaCli)}
          ${bizForecastCard('MRR',mrr.total,fc.mrr,deltaMrr,'€')}
          ${bizForecastCard('Followers',totalFollowers,(bizConfig.start_followers||0)+fc.followers,deltaFoll)}
        </div>
      </div>
    </div>
  </div>`;
}

// ── Dashboard builders ──
function bizFieldRow(label, field, val, target, step) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(51,51,51,0.3);">
    <span style="font-size:12px;color:var(--text2);">${label}</span>
    ${target !== '' ? `<span style="font-size:10px;color:var(--text3);">obj: ${target}</span>` : '<span></span>'}
    <input type="number" value="${val}" min="0" step="${step||'1'}" style="width:70px;text-align:center;padding:5px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;font-weight:600;" onchange="bizUpdateField('${field}',this.value)">
  </div>`;
}

function bizWeekRow(label, val, target) {
  const ok = val >= target;
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;font-size:12px;">
    <span style="color:var(--text2);">${label}</span>
    <span><span style="font-weight:700;color:${ok?'var(--success)':'var(--text)'};">${val}</span> <span style="color:var(--text3);">/ ${target}</span> <span style="color:${ok?'var(--success)':'var(--danger)'};">${ok?'✓':'✗'}</span></span>
  </div>`;
}

function bizFunnelRow(icon, name, val, rate) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;background:rgba(255,255,255,0.02);border-radius:8px;">
    <span style="font-size:18px;width:28px;text-align:center;">${icon}</span>
    <div style="flex:1;"><div style="font-size:11px;color:var(--text3);">${name}</div><div style="font-size:18px;font-weight:700;">${val}</div></div>
    ${rate !== null ? `<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:rgba(179,8,8,0.12);color:var(--primary);">${rate}</span>` : ''}
  </div>`;
}

function bizPredRow(label, pct) {
  return `<div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid rgba(51,51,51,0.2);">
    <span style="font-size:12px;color:var(--text2);min-width:70px;">${label}</span>
    <div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;margin:0 10px;">
      <div style="height:100%;width:${pct}%;background:${bizProbColor(pct)};border-radius:3px;transition:width 0.5s;"></div>
    </div>
    <span style="font-size:13px;font-weight:700;min-width:36px;text-align:right;color:${bizProbColor(pct)};">${pct}%</span>
  </div>`;
}

function bizMetricRow(label, val) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(51,51,51,0.2);">
    <span style="font-size:12px;color:var(--text2);">${label}</span>
    <span style="font-size:13px;font-weight:700;">${val}</span>
  </div>`;
}

function bizForecastCard(label, real, forecast, delta, suffix) {
  suffix = suffix || '';
  const cls = delta >= 0 ? 'var(--success)' : 'var(--danger)';
  const sign = delta >= 0 ? '+' : '';
  return `<div style="background:var(--bg3);border-radius:10px;padding:12px;text-align:center;">
    <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">${label}</div>
    <div style="display:flex;justify-content:space-around;">
      <div><div style="font-size:9px;color:var(--text3);">Réel</div><div style="font-size:15px;font-weight:700;">${real.toLocaleString('fr-FR')}${suffix}</div></div>
      <div><div style="font-size:9px;color:var(--text3);">Prévu</div><div style="font-size:15px;font-weight:700;color:var(--text3);">${forecast.toLocaleString('fr-FR')}${suffix}</div></div>
    </div>
    <div style="font-size:11px;font-weight:600;color:${cls};margin-top:4px;">${sign}${delta.toLocaleString('fr-FR')}${suffix}</div>
  </div>`;
}

// ── Dashboard actions ──
async function bizSelectDay(day) {
  bizDay = day;
  bizRenderAll();
}

async function bizUpdateField(field, value) {
  const val = field === 'meta_ads_budget' ? parseFloat(value)||0 : parseInt(value)||0;
  await bizUpsertEntry(bizWeek, bizDay, { [field]: val });
  bizAllEntries = await bizLoadAllEntries();
  bizWeekEntries = bizAllEntries.filter(e => e.week_number === bizWeek);
  bizRenderAll();
}

async function bizChangeWeek(dir) {
  const nw = bizWeek + dir;
  if (nw < 1 || nw > 16) return;
  bizWeek = nw;
  await bizSaveConfig({ week_number: bizWeek });
  bizConfig.week_number = bizWeek;
  bizWeekEntries = bizAllEntries.filter(e => e.week_number === bizWeek);
  bizObjectives = await bizLoadObjectives(bizWeek);
  bizRenderAll();
}

// ===== OBJECTIVES PAGE =====
async function bizRenderObjectives() {
  const el = document.getElementById('biz-tab-content');
  const obj = bizObjectives;

  let weeksHtml = '';
  for (let w = 1; w <= 16; w++) {
    const we = bizAllEntries.filter(e => e.week_number === w);
    const wDms = bizSum(we,'dms'), wRdvs = bizSum(we,'rdvs'),
      wRdvsA = bizSum(we,'rdvs_attended'),
      wCli = bizSum(we,'clients_online') + bizSum(we,'clients_offline'),
      wReels = bizSum(we,'reels'), wFoll = bizSum(we,'followers');
    const filled = new Set(we.map(e=>e.day_name)).size;
    const cur = w === bizWeek;

    weeksHtml += `
      <div class="biz-wk-hdr" onclick="this.nextElementSibling.classList.toggle('open')" style="${cur?'border-left:3px solid var(--primary);':''}">
        <span style="font-size:13px;font-weight:600;">${cur?'→ ':''}Semaine ${w}</span>
        <span style="font-size:11px;color:var(--text3);">${filled}/6 jours · ${wDms} DMs · ${wCli} clients</span>
      </div>
      <div class="biz-wk-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">
          <div class="biz-recap"><div style="font-size:16px;font-weight:700;">${wDms}</div><div style="font-size:10px;color:var(--text3);">DMs</div></div>
          <div class="biz-recap"><div style="font-size:16px;font-weight:700;">${wRdvs}</div><div style="font-size:10px;color:var(--text3);">RDVs</div></div>
          <div class="biz-recap"><div style="font-size:16px;font-weight:700;">${wRdvsA}</div><div style="font-size:10px;color:var(--text3);">Honorés</div></div>
          <div class="biz-recap"><div style="font-size:16px;font-weight:700;">${wCli}</div><div style="font-size:10px;color:var(--text3);">Clients</div></div>
          <div class="biz-recap"><div style="font-size:16px;font-weight:700;">${wReels}</div><div style="font-size:10px;color:var(--text3);">Reels</div></div>
          <div class="biz-recap"><div style="font-size:16px;font-weight:700;">${wFoll}</div><div style="font-size:10px;color:var(--text3);">Followers</div></div>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div style="max-width:800px;">
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">Objectifs hebdomadaires (à partir de S${bizWeek})</div></div>
        ${bizObjInput('DMs / semaine','obj-dms',obj.dms_target)}
        ${bizObjInput('RDVs / semaine','obj-rdvs',obj.rdvs_target)}
        ${bizObjInput('RDVs honorés','obj-rdvsa',obj.rdvs_attended_target)}
        ${bizObjInput('Clients / semaine','obj-clients',obj.clients_target)}
        ${bizObjInput('Reels / semaine','obj-reels',obj.reels_target)}
        ${bizObjInput('Followers / semaine','obj-followers',obj.followers_target)}
        <div style="margin-top:14px;">
          <button class="btn btn-red" onclick="bizSaveObj()"><i class="fas fa-check"></i> Sauvegarder</button>
          <span style="font-size:11px;color:var(--text3);margin-left:8px;">Appliqué à partir de S${bizWeek}</span>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Historique des 16 semaines</div></div>
        ${weeksHtml}
      </div>
    </div>`;
}

function bizObjInput(label, id, val) {
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <span style="font-size:12px;color:var(--text2);min-width:140px;">${label}</span>
    <input type="number" id="${id}" value="${val}" class="inline-input" style="width:80px;">
  </div>`;
}

async function bizSaveObj() {
  await bizSaveObjectives(bizWeek, {
    dms_target: parseInt(document.getElementById('obj-dms').value)||200,
    rdvs_target: parseInt(document.getElementById('obj-rdvs').value)||6,
    rdvs_attended_target: parseInt(document.getElementById('obj-rdvsa').value)||4,
    clients_target: parseInt(document.getElementById('obj-clients').value)||2,
    reels_target: parseInt(document.getElementById('obj-reels').value)||7,
    followers_target: parseInt(document.getElementById('obj-followers').value)||60,
  });
  bizObjectives = await bizLoadObjectives(bizWeek);
  notify('Objectifs sauvegardés !', 'success');
}

// ===== CLIENTS PAGE =====
function bizRenderClients() {
  const el = document.getElementById('biz-tab-content');
  const active = bizClients.filter(c => c.status === 'active');
  const archived = bizClients.filter(c => c.status === 'archived');
  const online = active.filter(c => c.client_type === 'online');
  const offline = active.filter(c => c.client_type === 'offline');
  const mrr = bizMRR(bizClients);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <span style="font-size:16px;font-weight:700;">${active.length} clients actifs</span>
        <span style="font-size:13px;color:var(--text2);margin-left:10px;">MRR: ${mrr.total.toLocaleString('fr-FR')}€</span>
      </div>
      <button class="btn btn-red" onclick="bizOpenAddClient()"><i class="fas fa-plus"></i> Ajouter</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card">
        <div class="card-header"><div class="card-title">Online (${online.length}) — ${mrr.online.toLocaleString('fr-FR')}€/mois</div></div>
        ${online.length ? online.map(c => bizClientRow(c)).join('') : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucun client online</div>'}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Présentiel (${offline.length}) — ${mrr.offline.toLocaleString('fr-FR')}€/mois</div></div>
        ${offline.length ? offline.map(c => bizClientRow(c)).join('') : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucun client présentiel</div>'}
      </div>
    </div>

    ${archived.length ? `
    <div class="card" style="margin-top:16px;">
      <div class="card-header" style="cursor:pointer;" onclick="document.getElementById('biz-archived').style.display=document.getElementById('biz-archived').style.display==='none'?'block':'none'">
        <div class="card-title">Archivés (${archived.length}) ▾</div>
      </div>
      <div id="biz-archived" style="display:none;">
        ${archived.map(c => `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:3px;border-radius:6px;background:rgba(255,255,255,0.02);opacity:0.6;">
          <div><div style="font-size:12px;font-weight:600;">${escHtml(c.name)}</div><div style="font-size:10px;color:var(--text3);">${c.archive_reason||'Archivé'}</div></div>
          <span style="font-size:12px;color:var(--text3);">${c.price}€/mois</span>
        </div>`).join('')}
      </div>
    </div>` : ''}
  `;
}

function bizStripeStatusBadge(clientId) {
  const s = bizStripeData[clientId];
  if (!s) return '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(128,128,128,0.2);color:var(--text3);">Pas de paiement</span>';
  const colors = { active: '#22c55e', past_due: '#f59e0b', canceled: '#ef4444' };
  const labels = { active: 'Actif', past_due: 'En retard', canceled: 'Annulé' };
  const color = colors[s.subscription_status] || '#6b7280';
  const label = labels[s.subscription_status] || s.subscription_status;
  return `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:${color}22;color:${color};font-weight:600;">${label}</span>`;
}

async function bizSendPaymentLink(clientId) {
  const c = bizClients.find(cl => cl.id === clientId);
  if (!c) return;
  if (!c.email) { notify('Email manquant pour ce client. Modifiez le client pour ajouter un email.', 'error'); return; }
  const btn = document.getElementById('biz-pay-btn-' + clientId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  try {
    const res = await fetch('/api/stripe-create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        athleteName: c.name,
        athleteEmail: c.email,
        monthlyAmount: c.price * 100,
        coachId: currentUser.id,
        athleteId: clientId,
      }),
    });
    const data = await res.json();
    if (data.url) {
      await navigator.clipboard.writeText(data.url);
      notify('Lien de paiement copié !', 'success');
    } else {
      notify('Erreur: ' + (data.error || 'Impossible de créer le lien'), 'error');
    }
  } catch (err) {
    notify('Erreur réseau: ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-link"></i>'; }
}

async function bizCancelSubscription(clientId) {
  const s = bizStripeData[clientId];
  if (!s || !s.stripe_subscription_id) { notify('Aucun abonnement trouvé', 'error'); return; }
  if (!confirm('Annuler l\'abonnement Stripe de ce client ?')) return;
  try {
    const res = await fetch('/api/stripe-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: s.stripe_subscription_id }),
    });
    const data = await res.json();
    if (data.status === 'canceled') {
      notify('Abonnement annulé', 'success');
      bizStripeData = await bizLoadStripeData();
      bizRenderAll();
    } else {
      notify('Erreur: ' + (data.error || 'Echec'), 'error');
    }
  } catch (err) {
    notify('Erreur réseau: ' + err.message, 'error');
  }
}

async function bizShowPaymentHistory(clientId) {
  const s = bizStripeData[clientId];
  if (!s) { notify('Aucun paiement Stripe pour ce client', 'error'); return; }
  const history = await bizLoadPaymentHistory(s.stripe_customer_id);
  const modal = document.createElement('div');
  modal.id = 'biz-payment-modal';
  modal.className = 'modal-overlay open';
  modal.onclick = () => modal.remove();
  const rows = history.length ? history.map(h => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:12px;font-weight:600;">${(h.amount / 100).toLocaleString('fr-FR')}€</div>
        <div style="font-size:10px;color:var(--text3);">${new Date(h.period_start).toLocaleDateString('fr-FR')} - ${new Date(h.period_end).toLocaleDateString('fr-FR')}</div>
      </div>
      <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${h.status === 'succeeded' ? '#22c55e22' : '#ef444422'};color:${h.status === 'succeeded' ? '#22c55e' : '#ef4444'};font-weight:600;">${h.status === 'succeeded' ? 'Payé' : 'Echoué'}</span>
    </div>
  `).join('') : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucun paiement enregistré</div>';
  modal.innerHTML = `<div class="modal" onclick="event.stopPropagation();" style="max-width:440px;">
    <div class="modal-header"><h2 class="modal-title">Historique paiements</h2><button class="modal-close" onclick="document.getElementById('biz-payment-modal').remove()">×</button></div>
    <div style="margin-top:8px;">${rows}</div>
    ${s.subscription_status === 'active' ? `<div style="margin-top:16px;text-align:right;"><button class="btn btn-outline" style="color:var(--danger);font-size:11px;" onclick="document.getElementById('biz-payment-modal').remove();bizCancelSubscription('${clientId}')"><i class="fas fa-ban"></i> Annuler l'abonnement</button></div>` : ''}
  </div>`;
  document.body.appendChild(modal);
}

function bizClientRow(c) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:3px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid var(--border);">
    <div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:12px;font-weight:600;">${escHtml(c.name)}</span>
        ${bizStripeStatusBadge(c.id)}
      </div>
      <div style="font-size:10px;color:var(--text3);">Depuis ${new Date(c.start_date).toLocaleDateString('fr-FR')} · LTV: ${c.price*6}€</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:13px;font-weight:700;color:var(--success);">${c.price}€</span>
      <button id="biz-pay-btn-${c.id}" class="btn btn-outline btn-sm" onclick="bizSendPaymentLink('${c.id}')" title="Copier lien de paiement"><i class="fas fa-link"></i></button>
      ${bizStripeData[c.id] ? `<button class="btn btn-outline btn-sm" onclick="bizShowPaymentHistory('${c.id}')" title="Historique paiements"><i class="fas fa-receipt"></i></button>` : ''}
      <button class="btn btn-outline btn-sm" onclick="bizOpenEditClient('${c.id}')"><i class="fas fa-pen"></i></button>
      <button class="btn btn-outline btn-sm" onclick="bizOpenArchive('${c.id}')" style="color:var(--danger);"><i class="fas fa-box-archive"></i></button>
    </div>
  </div>`;
}

// ── Client modals ──
function bizOpenAddClient() {
  const modal = document.createElement('div');
  modal.id = 'biz-client-modal';
  modal.className = 'modal-overlay open';
  modal.onclick = () => modal.remove();
  modal.innerHTML = `<div class="modal" onclick="event.stopPropagation();">
    <div class="modal-header"><h2 class="modal-title">Ajouter un client</h2><button class="modal-close" onclick="document.getElementById('biz-client-modal').remove()">×</button></div>
    <div class="form-row">
      <div class="form-group"><label>Nom</label><input type="text" id="bc-name"></div>
      <div class="form-group"><label>Email</label><input type="email" id="bc-email" placeholder="Pour lien Stripe"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Prix (€/mois)</label><input type="number" id="bc-price" min="1"></div>
      <div class="form-group"><label>Type</label><select id="bc-type"><option value="online">Online</option><option value="offline">Présentiel</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Jour facturation</label><input type="text" id="bc-billing" value="1"></div>
      <div class="form-group"><label>Date début</label><input type="date" id="bc-start" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="document.getElementById('biz-client-modal').remove()">Annuler</button>
      <button class="btn btn-red" onclick="bizSubmitAdd()">Ajouter</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function bizSubmitAdd() {
  const name = document.getElementById('bc-name').value.trim();
  const price = parseInt(document.getElementById('bc-price').value);
  if (!name || !price) { notify('Nom et prix requis','error'); return; }
  await bizAddClient({
    name, price,
    email: document.getElementById('bc-email').value.trim() || null,
    client_type: document.getElementById('bc-type').value,
    billing_day: document.getElementById('bc-billing').value || '1',
    start_date: document.getElementById('bc-start').value || new Date().toISOString().split('T')[0]
  });
  document.getElementById('biz-client-modal').remove();
  bizClients = await bizLoadClients();
  bizRenderAll();
  notify('Client ajouté !','success');
}

function bizOpenEditClient(id) {
  const c = bizClients.find(cl => cl.id === id);
  if (!c) return;
  const modal = document.createElement('div');
  modal.id = 'biz-client-modal';
  modal.className = 'modal-overlay open';
  modal.onclick = () => modal.remove();
  modal.innerHTML = `<div class="modal" onclick="event.stopPropagation();">
    <div class="modal-header"><h2 class="modal-title">Modifier le client</h2><button class="modal-close" onclick="document.getElementById('biz-client-modal').remove()">×</button></div>
    <div class="form-row">
      <div class="form-group"><label>Nom</label><input type="text" id="bc-name" value="${escHtml(c.name)}"></div>
      <div class="form-group"><label>Email</label><input type="email" id="bc-email" value="${escHtml(c.email || '')}" placeholder="Pour lien Stripe"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Prix (€/mois)</label><input type="number" id="bc-price" value="${c.price}"></div>
      <div class="form-group"><label>Type</label><select id="bc-type"><option value="online" ${c.client_type==='online'?'selected':''}>Online</option><option value="offline" ${c.client_type==='offline'?'selected':''}>Présentiel</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Jour facturation</label><input type="text" id="bc-billing" value="${escHtml(c.billing_day)}"></div>
      <div class="form-group"><label>Date début</label><input type="date" id="bc-start" value="${c.start_date}"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:16px;">
      <button class="btn btn-outline" onclick="bizConfirmDelete('${id}')" style="color:var(--danger);">Supprimer</button>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline" onclick="document.getElementById('biz-client-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="bizSubmitEdit('${id}')">Sauvegarder</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function bizSubmitEdit(id) {
  await bizUpdateClient(id, {
    name: document.getElementById('bc-name').value.trim(),
    email: document.getElementById('bc-email').value.trim() || null,
    price: parseInt(document.getElementById('bc-price').value),
    client_type: document.getElementById('bc-type').value,
    billing_day: document.getElementById('bc-billing').value,
    start_date: document.getElementById('bc-start').value
  });
  document.getElementById('biz-client-modal').remove();
  bizClients = await bizLoadClients();
  bizRenderAll();
  notify('Client mis à jour !','success');
}

function bizOpenArchive(id) {
  const modal = document.createElement('div');
  modal.id = 'biz-client-modal';
  modal.className = 'modal-overlay open';
  modal.onclick = () => modal.remove();
  modal.innerHTML = `<div class="modal" onclick="event.stopPropagation();">
    <div class="modal-header"><h2 class="modal-title">Archiver le client</h2><button class="modal-close" onclick="document.getElementById('biz-client-modal').remove()">×</button></div>
    <div class="form-group"><label>Raison (optionnel)</label><input type="text" id="bc-reason" placeholder="Ex: Fin de contrat..."></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="document.getElementById('biz-client-modal').remove()">Annuler</button>
      <button class="btn btn-red" onclick="bizSubmitArchive('${id}')">Archiver</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function bizSubmitArchive(id) {
  await bizArchiveClient(id, document.getElementById('bc-reason').value.trim());
  document.getElementById('biz-client-modal').remove();
  bizClients = await bizLoadClients();
  bizRenderAll();
  notify('Client archivé','success');
}

async function bizConfirmDelete(id) {
  if (!confirm('Supprimer définitivement ce client ?')) return;
  await bizDeleteClient(id);
  document.getElementById('biz-client-modal').remove();
  bizClients = await bizLoadClients();
  bizRenderAll();
  notify('Client supprimé','success');
}
