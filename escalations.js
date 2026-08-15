// routes/escalations.js
const express = require('express');
const threadRepo = require('./threadRepository');

const router = express.Router();

// GET /api/escalations — everything escalated so far in this session,
// across all threads. This is what a real handoff queue would read from.
router.get('/', (req, res) => {
  res.json({ escalations: threadRepo.listEscalations(req.sessionId) });
});

module.exports = router;
