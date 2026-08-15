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

// Serve static files (CSS, JS, images) directly from the root directory
app.use(express.static(__dirname));

// Serve index.html directly from the root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Orders lookup doesn't need a session
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
