// ===== BUSINESS — MESSAGES INBOX =====

window._bizConversations = [];
window._bizMessages = [];
window._bizSelectedConvo = null;

let _msgSearch = '';

// ── Data layer ──
async function _bizLoadConversations() {
  const { data, error } = await supabaseClient
    .from('ig_conversations')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('last_message_at', { ascending: false });
  if (error) handleError(error, 'messages');
  window._bizConversations = data || [];
  return window._bizConversations;
}

async function _bizLoadMessages(conversationId) {
  const { data, error } = await supabaseClient
    .from('ig_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) handleError(error, 'messages');
  window._bizMessages = data || [];
  return window._bizMessages;
}

// ── Helpers ──
function _bizTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + ' h';
  if (diff < 604800) return Math.floor(diff / 86400) + ' j';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function _bizFormatMsgTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── Main render ──
async function bizRenderMessages() {
  const el = document.getElementById('biz-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  await _bizLoadConversations();

  el.innerHTML = `
    <div style="display:flex;height:calc(100vh - 220px);border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--bg2);">
      <!-- Left column: conversation list -->
      <div id="msg-convo-list" style="width:300px;min-width:300px;border-right:1px solid var(--border);display:flex;flex-direction:column;background:var(--bg1);">
        <div style="padding:12px;border-bottom:1px solid var(--border);">
          <input type="text" id="msg-search" placeholder="Rechercher..." value="${escHtml(_msgSearch)}"
            oninput="_msgSearch=this.value;_bizRenderConvoList()"
            style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:12px;box-sizing:border-box;">
        </div>
        <div id="msg-convo-items" style="flex:1;overflow-y:auto;"></div>
      </div>
      <!-- Right column: message thread -->
      <div id="msg-thread" style="flex:1;display:flex;flex-direction:column;background:var(--bg1);">
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:13px;">
          <div style="text-align:center;">
            <i class="fas fa-comments" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.3;"></i>
            Sélectionnez une conversation
          </div>
        </div>
      </div>
    </div>`;

  _bizRenderConvoList();

  // Auto-select first conversation if available
  if (window._bizConversations.length > 0 && !window._bizSelectedConvo) {
    bizSelectConversation(window._bizConversations[0].id);
  } else if (window._bizSelectedConvo) {
    bizSelectConversation(window._bizSelectedConvo);
  }
}

function _bizRenderConvoList() {
  const container = document.getElementById('msg-convo-items');
  if (!container) return;

  let convos = window._bizConversations || [];

  // Apply search filter
  if (_msgSearch) {
    const s = _msgSearch.toLowerCase();
    convos = convos.filter(c =>
      (c.participant_name || '').toLowerCase().includes(s) ||
      (c.last_message || '').toLowerCase().includes(s)
    );
  }

  if (convos.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);font-size:12px;">Aucune conversation</div>`;
    return;
  }

  container.innerHTML = convos.map(c => {
    const isActive = window._bizSelectedConvo === c.id;
    const lastMsg = (c.last_message || '').length > 40 ? c.last_message.substring(0, 40) + '...' : (c.last_message || '');
    const unread = c.unread_count || 0;
    const initial = (c.participant_name || '?')[0].toUpperCase();

    return `
      <div onclick="bizSelectConversation('${c.id}')"
        style="display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s;${isActive ? 'background:var(--bg3);' : ''}"
        onmouseover="if(!${isActive})this.style.background='var(--bg2)'" onmouseout="if(!${isActive})this.style.background='transparent'">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:var(--text2);flex-shrink:0;">${escHtml(initial)}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.participant_name || 'Inconnu')}</span>
            <span style="font-size:10px;color:var(--text3);flex-shrink:0;margin-left:6px;">${_bizTimeAgo(c.last_message_at)}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
            <span style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lastMsg)}</span>
            ${unread > 0 ? `<span style="background:var(--primary);color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;flex-shrink:0;margin-left:6px;">${unread}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Select conversation ──
async function bizSelectConversation(id) {
  window._bizSelectedConvo = id;

  // Re-render convo list to update active state
  _bizRenderConvoList();

  const thread = document.getElementById('msg-thread');
  if (!thread) return;

  thread.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><i class="fas fa-spinner fa-spin" style="color:var(--text3);"></i></div>';

  const convo = (window._bizConversations || []).find(c => c.id === id);
  await _bizLoadMessages(id);

  const participantName = convo ? (convo.participant_name || 'Inconnu') : 'Inconnu';
  const participantStatus = convo && convo.participant_status ? convo.participant_status : '';

  const messagesHtml = (window._bizMessages || []).map(m => {
    const isCoach = m.sender === 'coach';
    return `
      <div style="display:flex;justify-content:${isCoach ? 'flex-end' : 'flex-start'};margin-bottom:8px;">
        <div style="max-width:65%;padding:10px 14px;font-size:13px;line-height:1.5;
          background:${isCoach ? 'var(--primary)' : 'var(--bg3)'};
          color:${isCoach ? '#fff' : 'var(--text)'};
          border-radius:${isCoach ? '12px 12px 0 12px' : '12px 12px 12px 0'};">
          <div>${escHtml(m.text || m.content || '')}</div>
          <div style="font-size:9px;margin-top:4px;opacity:0.6;text-align:${isCoach ? 'right' : 'left'};">${_bizFormatMsgTime(m.created_at)}</div>
        </div>
      </div>`;
  }).join('');

  thread.innerHTML = `
    <!-- Header -->
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:var(--text2);">${escHtml(participantName[0].toUpperCase())}</div>
      <div>
        <div style="font-weight:600;font-size:14px;color:var(--text);">${escHtml(participantName)}</div>
        ${participantStatus ? `<div style="font-size:11px;color:var(--text3);">${escHtml(participantStatus)}</div>` : ''}
      </div>
    </div>
    <!-- Messages -->
    <div id="msg-messages-list" style="flex:1;overflow-y:auto;padding:16px;">
      ${messagesHtml || '<div style="text-align:center;color:var(--text3);font-size:12px;padding:40px;">Aucun message</div>'}
    </div>
    <!-- Input -->
    <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end;">
      <textarea id="msg-input" placeholder="Écrire un message..." rows="1"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();bizSendMessage('${id}')}"
        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"
        style="flex:1;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:13px;font-family:inherit;resize:none;line-height:1.4;max-height:100px;"></textarea>
      <button onclick="bizSendMessage('${id}')" class="btn btn-red btn-sm" style="height:38px;padding:0 16px;border-radius:12px;flex-shrink:0;">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>`;

  // Auto-scroll to bottom
  setTimeout(() => {
    const list = document.getElementById('msg-messages-list');
    if (list) list.scrollTop = list.scrollHeight;
  }, 50);
}

// ── Send message ──
async function bizSendMessage(conversationId) {
  const input = document.getElementById('msg-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  // Insert message
  const { error } = await supabaseClient.from('ig_messages').insert({
    conversation_id: conversationId,
    sender: 'coach',
    text: text,
    created_at: new Date().toISOString()
  });
  if (error) { handleError(error, 'messages'); return; }

  // Update conversation last message
  await supabaseClient.from('ig_conversations').update({
    last_message: text,
    last_message_at: new Date().toISOString()
  }).eq('id', conversationId);

  // Refresh
  await _bizLoadConversations();
  _bizRenderConvoList();
  await bizSelectConversation(conversationId);
}
