// public/app.js
// Vanilla JS frontend — no build step. Talks to the Express API for
// everything: threads, messages, and the escalation queue.

const API = '';

function getSessionId() {
  let id = localStorage.getItem('northstar_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('northstar_session_id', id);
  }
  return id;
}
const SESSION_ID = getSessionId();

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': SESSION_ID,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

/* ---------------- STATE ---------------- */
let threads = [];
let activeThreadId = null;

/* ---------------- DOM ---------------- */
const threadListEl = document.getElementById('threadList');
const chatTitleEl = document.getElementById('chatTitle');
const messagesEl = document.getElementById('messages');
const trailEl = document.getElementById('trail');
const queueEl = document.getElementById('queue');
const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

/* ---------------- RENDER: THREADS ---------------- */
function renderThreadList() {
  threadListEl.innerHTML = '';
  if (threads.length === 0) {
    threadListEl.innerHTML = '<div class="trail-empty">No threads yet — start one.</div>';
    return;
  }
  threads.forEach((t) => {
    const el = document.createElement('div');
    el.className = 'thread-item' + (t.id === activeThreadId ? ' active' : '');
    el.innerHTML = `<span>${escapeHtml(t.title)}</span><span class="del" title="Delete thread">✕</span>`;
    el.querySelector('span:first-child').addEventListener('click', () => switchThread(t.id));
    el.querySelector('.del').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteThread(t.id);
    });
    threadListEl.appendChild(el);
  });
}

/* ---------------- RENDER: MESSAGES ---------------- */
function addMsgToDom(text, who, tag) {
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.textContent = text;
  if (tag) {
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = tag;
    div.appendChild(meta);
  }
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessages(msgs) {
  messagesEl.innerHTML = '';
  if (msgs.length === 0) {
    addMsgToDom(
      "Hi, I'm the Northstar support assistant. I can check your order status, start a return, or check a refund. What order are we looking at? (e.g. NS1005)",
      'bot'
    );
    return;
  }
  msgs.forEach((m) => {
    const who = m.role === 'user' ? 'user' : m.escalated ? 'escalate' : 'bot';
    const tag = m.role === 'bot' ? buildTag(m) : null;
    addMsgToDom(m.content, who, tag);
  });
  const lastBot = [...msgs].reverse().find((m) => m.role === 'bot');
  renderTrail(lastBot ? lastBot.trail : null);
}

const INTENT_LABELS = { status: 'ORDER STATUS', return: 'RETURN', refund: 'REFUND', kb: 'KNOWLEDGE BASE', unknown: 'UNCLEAR' };

function buildTag(m) {
  const label = INTENT_LABELS[m.intent] || (m.intent ? m.intent.toUpperCase() : null);
  if (m.escalated) return 'ESCALATED' + (label ? ' · ' + label : '');
  if (!label) return null;
  return label + (m.orderId ? ' · ' + m.orderId : '');
}

/* ---------------- RENDER: TRAIL + QUEUE ---------------- */
function renderTrail(nodes) {
  if (!nodes || nodes.length === 0) {
    trailEl.innerHTML = '<div class="trail-empty">No query yet in this thread.</div>';
    return;
  }
  trailEl.innerHTML = '';
  nodes.forEach((n) => {
    const d = document.createElement('div');
    d.className = 'trail-node' + (n.hit ? ' hit' : '') + (n.escalated ? ' escalated' : '');
    d.innerHTML = `<span class="dot"></span><span class="label">${escapeHtml(n.label)}</span>`;
    trailEl.appendChild(d);
  });
}

async function refreshQueue() {
  const { escalations } = await api('/api/escalations');
  if (escalations.length === 0) {
    queueEl.innerHTML = '<div class="queue-empty">Nothing escalated yet.</div>';
    return;
  }
  queueEl.innerHTML = '';
  escalations.forEach((e) => {
    const d = document.createElement('div');
    d.className = 'queue-item';
    d.innerHTML = `<span class="oid">${escapeHtml(e.order_id || '—')}</span><span class="why">${escapeHtml(e.reason)}</span>`;
    queueEl.appendChild(d);
  });
}

/* ---------------- ACTIONS ---------------- */
async function loadThreads() {
  const { threads: list } = await api('/api/threads');
  threads = list;
  if (!activeThreadId && threads.length > 0) activeThreadId = threads[0].id;
  if (threads.length === 0) await createThread();
  renderThreadList();
}

async function createThread() {
  const { thread } = await api('/api/threads', { method: 'POST' });
  threads.unshift(thread);
  activeThreadId = thread.id;
  renderThreadList();
  chatTitleEl.textContent = thread.title;
  renderMessages([]);
}

async function switchThread(id) {
  activeThreadId = id;
  renderThreadList();
  const thread = threads.find((t) => t.id === id);
  chatTitleEl.textContent = thread ? thread.title : 'Conversation';
  const { messages } = await api(`/api/threads/${id}/messages`);
  renderMessages(messages);
}

async function deleteThread(id) {
  await api(`/api/threads/${id}`, { method: 'DELETE' });
  threads = threads.filter((t) => t.id !== id);
  if (activeThreadId === id) {
    activeThreadId = null;
    if (threads.length > 0) await switchThread(threads[0].id);
    else await createThread();
  } else {
    renderThreadList();
  }
}

async function sendMessage(text) {
  if (!activeThreadId) await createThread();
  addMsgToDom(text, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;
  try {
    const { botMessage } = await api(`/api/threads/${activeThreadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: text }),
    });
    const who = botMessage.escalated ? 'escalate' : 'bot';
    addMsgToDom(botMessage.content, who, buildTag(botMessage));
    renderTrail(botMessage.trail);
    // thread title may have just been set from the first message
    const t = threads.find((x) => x.id === activeThreadId);
    if (t) {
      const fresh = await api('/api/threads');
      threads = fresh.threads;
      renderThreadList();
      const updated = threads.find((x) => x.id === activeThreadId);
      if (updated) chatTitleEl.textContent = updated.title;
    }
    if (botMessage.escalated) refreshQueue();
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

/* ---------------- EVENTS ---------------- */
document.getElementById('newThreadBtn').addEventListener('click', () => createThread());

sendBtn.addEventListener('click', () => {
  const v = inputEl.value.trim();
  if (v) sendMessage(v);
});
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendBtn.click();
  }
});
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const prompts = {
      status: 'Can you check my order status?',
      return: "I'd like to return an item",
      refund: "What's the status of my refund?",
      policy: "What's your return policy?",
    };
    sendMessage(prompts[chip.dataset.intent]);
  });
});

/* ---------------- INIT ---------------- */
(async function init() {
  await loadThreads();
  if (activeThreadId) await switchThread(activeThreadId);
  refreshQueue();
})();
