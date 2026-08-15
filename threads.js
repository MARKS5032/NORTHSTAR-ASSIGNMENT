// routes/threads.js
const express = require('express');
const threadRepo = require('./threadRepository');

const router = express.Router();

// GET /api/threads — all threads for this session, newest first
router.get('/', (req, res) => {
  res.json({ threads: threadRepo.listThreads(req.sessionId) });
});

// POST /api/threads — start a new, empty thread
router.post('/', (req, res) => {
  const thread = threadRepo.createThread(req.sessionId);
  res.status(201).json({ thread });
});

// DELETE /api/threads/:id
router.delete('/:id', (req, res) => {
  const info = threadRepo.deleteThread(req.params.id, req.sessionId);
  if (info.changes === 0) return res.status(404).json({ error: 'Thread not found' });
  res.status(204).end();
});

module.exports = router;
