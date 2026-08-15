// routes/messages.js
const express = require('express');
const threadRepo = require('./threadRepository');
const { route } = require('./router');

const router = express.Router({ mergeParams: true });

// GET /api/threads/:threadId/messages
router.get('/', (req, res) => {
  const thread = threadRepo.getThread(req.params.threadId, req.sessionId);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json({ messages: threadRepo.listMessages(thread.id) });
});

// POST /api/threads/:threadId/messages  { content: string }
router.post('/', (req, res) => {
  const thread = threadRepo.getThread(req.params.threadId, req.sessionId);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });

  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'content is required' });

  const userMessage = threadRepo.addMessage(thread.id, { role: 'user', content });
  threadRepo.renameThreadIfDefault(thread, content);

  const result = route(content, thread);

  const botMessage = threadRepo.addMessage(thread.id, {
    role: 'bot',
    content: result.reply,
    intent: result.intent,
    orderId: result.orderId,
    escalated: result.escalated,
    trail: result.trail,
  });

  if (result.nextPending) {
    threadRepo.setPending(thread.id, result.nextPending.intent, result.nextPending.orderId);
  } else {
    threadRepo.clearPending(thread.id);
  }

  if (result.escalated) {
    threadRepo.logEscalation(req.sessionId, thread.id, result.orderId, result.escalationReason);
  }

  res.status(201).json({
    userMessage,
    botMessage: { ...botMessage, trail: result.trail },
  });
});

module.exports = router;
