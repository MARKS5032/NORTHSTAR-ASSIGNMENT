// server.js
const path = require('path');
const express = require('express');
const cors = require('cors');

const sessionMiddleware = require('./lib/sessionMiddleware');
const ordersRouter = require('./routes/orders');
const threadsRouter = require('./routes/threads');
const messagesRouter = require('./routes/messages');
const escalationsRouter = require('./routes/escalations');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Static frontend (no build step — plain HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

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
