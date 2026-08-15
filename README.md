# Northstar Support Chatbot — MVP

A support chatbot prototype for Northstar Retail Co., covering **order status**,
**returns**, and **refunds** with threaded, in-session conversations. Built by
the Support Automation Pod as a Week 1 proof of concept.

## Architecture

```
┌─────────────────────┐      REST/JSON       ┌───────────────────────┐      SQL      ┌──────────────┐
│  Frontend (public/)  │  ───────────────▶   │  Backend (Express)     │ ───────────▶  │  SQLite DB    │
│  vanilla HTML/CSS/JS │  ◀───────────────   │  decision trees +      │ ◀───────────  │  orders /     │
│  threaded chat UI     │                    │  thread/session logic  │               │  threads /    │
└─────────────────────┘                      └───────────────────────┘               │  messages /   │
                                                                                       │  escalations  │
                                                                                       └──────────────┘
```

- **Frontend** (`public/`) — no build step. A sidebar lists in-session
  conversation threads (like a chat app's thread list); each thread has its
  own independent message history and its own "Decision Trail" panel showing
  exactly which branch of the tree fired for the last answer.
- **Backend** (`server.js`, `lib/`, `routes/`) — Express REST API. All order
  facts are read through `lib/orderRepository.js`, which is the single place
  allowed to answer "what do we know about this order." The three decision
  trees live in `lib/decisionTrees.js`.
- **Database** (`db/`) — SQLite via `better-sqlite3`. `db/schema.sql` defines
  the tables; `db/seed.js` loads the **exact** rows transcribed from
  `Demo_Order_Database.pdf` — the order data is never hand-typed anywhere
  else in the codebase.

## Routing: order database vs. knowledge base

Every incoming message is classified before it touches any data source
(`lib/router.js`):

1. **Contains an order ID** (e.g. `NS1005`) → always resolved against the
   `orders` table. Order data never comes from anywhere else.
2. **No order ID, but clearly about "my"/"this" order** (e.g. "track my
   order", "cancel my order", "status of my refund") → the bot asks for the
   order ID. It never guesses which order, and it never answers this kind
   of question from the knowledge base.
3. **No order ID, and reads like a general policy question** (e.g. "what's
   your return policy", "how long do refunds take") → answered from the
   Northstar Knowledge Base (`kb_articles` table, `lib/knowledgeBaseRepository.js`).
   If nothing in the KB matches well enough, the bot says so and escalates
   rather than inventing a policy.

The order database and the knowledge base are intentionally separate tables
with separate repository modules (`orderRepository.js` vs.
`knowledgeBaseRepository.js`) — no code path can blend order facts with
general policy text.

## Order-status source-of-truth rule

For every order-status question:
1. The customer's order ID is normalized and looked up in the `orders` table
   (`lib/orderRepository.js::getOrderById`).
2. If found, the reply is built **only** from that row's `status`, `product`,
   `expected_delivery`, `tracking_number`, `delivery_location`,
   `payment_status`, and `notes` fields — nothing is inferred or invented.
3. If not found, the bot never guesses. It replies that the order couldn't
   be found and asks the customer to verify the order ID, and logs the
   attempt to the escalation queue.

See `NOT_FOUND_REPLY` and `runOrderStatus` in `lib/decisionTrees.js`.

## Setup

Requires Node.js 18+.

```bash
npm install
npm run seed     # builds db/northstar.db from schema.sql + the PDF data
npm start        # http://localhost:3000
```

Open `http://localhost:3000` in a browser. Try order IDs `NS1001`–`NS1012`,
or a made-up one like `NS9999` to see the not-found path.

## API reference

| Method | Path                          | Notes                                   |
|--------|-------------------------------|------------------------------------------|
| GET    | `/api/orders/:id`              | Raw order lookup (source of truth)       |
| GET    | `/api/threads`                 | List threads for `x-session-id`          |
| POST   | `/api/threads`                 | Create a new thread                      |
| DELETE | `/api/threads/:id`              | Delete a thread                          |
| GET    | `/api/threads/:id/messages`     | List messages in a thread                |
| POST   | `/api/threads/:id/messages`     | Send a message, get the bot's reply      |
| GET    | `/api/escalations`              | Session-wide escalation queue            |

All endpoints except `/api/orders/:id` require an `x-session-id` header. The
frontend generates a UUID on first load and stores it in `localStorage` —
this stands in for real auth in the MVP.

## Threading model

Each thread is a fully independent conversation: its own message history,
its own mid-flow state (e.g. "waiting on a return reason"), and its own
decision trail. Threads persist in SQLite scoped to the session id, so
reloading the page keeps all open threads. The escalation queue is
session-wide (aggregated across threads), since that's what a real handoff
queue for a human agent would need.

## What's deliberately out of scope for this MVP

- Real authentication (session id substitutes for it)
- Stock-availability tickets (the third ticket type Northstar mentioned —
  not covered because the demo database has no inventory table yet)
- A production-grade NLU layer (intent detection is regex-based)
- Multi-agent handoff tooling beyond the escalation log
