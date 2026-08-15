// server.js
const path = require('path');
const express = require('express');
const cors = require('cors');

const sessionMiddleware = require('./sessionMiddleware');
const ordersRouter = require('./orders');
const threadsRouter = require('./threads');
const messagesRouter = require('./messages');
const escalationsRouter = require('./escalations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static assets (CSS, JS, images) from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Explicit route handler to serve index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Orders lookup doesn't need a session (useful for quick testing)
app.use('/api/orders', ordersRouter);

// Everything else is scoped to a browser session
app.use('/api/threads', sessionMiddleware, threadsRouter);
app.use('/api/threads/:threadId/messages', sessionMiddleware, messagesRouter);
app.use('/api/escalations', sessionMiddleware, escalationsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Northstar support chatbot running at http://localhost:${PORT}`);
});

module.exports = app;
