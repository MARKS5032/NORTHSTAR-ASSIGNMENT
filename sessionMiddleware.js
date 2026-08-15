// lib/sessionMiddleware.js
// Minimal stand-in for auth in this MVP: the frontend generates a UUID on
// first load, stores it in localStorage, and sends it as x-session-id on
// every request. Threads and escalations are scoped to that id.

module.exports = function sessionMiddleware(req, res, next) {
  const sessionId = req.header('x-session-id');
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing x-session-id header' });
  }
  req.sessionId = sessionId;
  next();
};
