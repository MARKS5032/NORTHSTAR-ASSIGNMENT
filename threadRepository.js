// lib/threadRepository.js
const { randomUUID } = require('crypto');
const db = require('./database');

const insertThread = db.prepare(
  `INSERT INTO threads (id, session_id, title) VALUES (?, ?, ?)`
);
const listThreadsStmt = db.prepare(
  `SELECT id, title, created_at FROM threads WHERE session_id = ? ORDER BY created_at DESC`
);
const getThreadStmt = db.prepare(
  `SELECT * FROM threads WHERE id = ? AND session_id = ?`
);
const renameThreadStmt = db.prepare(
  `UPDATE threads SET title = ? WHERE id = ?`
);
const setPendingStmt = db.prepare(
  `UPDATE threads SET pending_intent = ?, pending_order_id = ? WHERE id = ?`
);
const deleteThreadStmt = db.prepare(
  `DELETE FROM threads WHERE id = ? AND session_id = ?`
);

const insertMessage = db.prepare(`
  INSERT INTO messages (thread_id, role, content, intent, order_id, escalated, trail_json)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const listMessagesStmt = db.prepare(
  `SELECT * FROM messages WHERE thread_id = ? ORDER BY id ASC`
);

const insertEscalation = db.prepare(`
  INSERT INTO escalations (session_id, thread_id, order_id, reason) VALUES (?, ?, ?, ?)
`);
const listEscalationsStmt = db.prepare(
  `SELECT * FROM escalations WHERE session_id = ? ORDER BY created_at DESC LIMIT 50`
);

function createThread(sessionId, title = 'New conversation') {
  const id = randomUUID();
  insertThread.run(id, sessionId, title);
  return getThreadStmt.get(id, sessionId);
}

function listThreads(sessionId) {
  return listThreadsStmt.all(sessionId);
}

function getThread(threadId, sessionId) {
  return getThreadStmt.get(threadId, sessionId) || null;
}

function renameThreadIfDefault(thread, firstUserMessage) {
  if (thread.title === 'New conversation') {
    const title = firstUserMessage.slice(0, 48) + (firstUserMessage.length > 48 ? '…' : '');
    renameThreadStmt.run(title, thread.id);
  }
}

function setPending(threadId, intent, orderId) {
  setPendingStmt.run(intent, orderId, threadId);
}

function clearPending(threadId) {
  setPendingStmt.run(null, null, threadId);
}

function deleteThread(threadId, sessionId) {
  return deleteThreadStmt.run(threadId, sessionId);
}

function addMessage(threadId, { role, content, intent = null, orderId = null, escalated = false, trail = null }) {
  const info = insertMessage.run(threadId, role, content, intent, orderId, escalated ? 1 : 0, trail ? JSON.stringify(trail) : null);
  return { id: info.lastInsertRowid, threadId, role, content, intent, orderId, escalated, trail };
}

function listMessages(threadId) {
  return listMessagesStmt.all(threadId).map((m) => ({
    ...m,
    escalated: !!m.escalated,
    trail: m.trail_json ? JSON.parse(m.trail_json) : null,
  }));
}

function logEscalation(sessionId, threadId, orderId, reason) {
  insertEscalation.run(sessionId, threadId, orderId, reason);
}

function listEscalations(sessionId) {
  return listEscalationsStmt.all(sessionId);
}

module.exports = {
  createThread,
  listThreads,
  getThread,
  renameThreadIfDefault,
  setPending,
  clearPending,
  deleteThread,
  addMessage,
  listMessages,
  logEscalation,
  listEscalations,
};
