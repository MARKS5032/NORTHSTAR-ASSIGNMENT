-- Northstar Retail Co. — support chatbot database schema

-- Source of truth for all order-status answers.
-- Nothing in the application layer is allowed to invent or override these fields.
CREATE TABLE IF NOT EXISTS orders (
  id                 TEXT PRIMARY KEY,        -- e.g. NS1001
  customer_name      TEXT NOT NULL,
  product            TEXT NOT NULL,
  order_date         TEXT NOT NULL,           -- ISO date
  expected_delivery  TEXT NOT NULL,           -- ISO date
  status             TEXT NOT NULL,           -- Processing | Shipped | Out for Delivery | Delivered | Delayed | Cancelled
  tracking_number    TEXT,                    -- NULL when not yet assigned
  delivery_location  TEXT NOT NULL,
  payment_status     TEXT NOT NULL,           -- Paid | Refunded
  return_eligible    TEXT NOT NULL,           -- Yes | No
  notes              TEXT
);

-- A "thread" is one in-session conversation. A browser session can hold many
-- threads at once (sidebar), each with its own independent message history.
CREATE TABLE IF NOT EXISTS threads (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL,
  title              TEXT NOT NULL DEFAULT 'New conversation',
  pending_intent     TEXT,             -- e.g. 'return_reason' when the bot is mid-flow
  pending_order_id   TEXT,             -- the order that pending_intent refers to
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','bot')),
  content     TEXT NOT NULL,
  intent      TEXT,                 -- status | return | refund | unknown
  order_id    TEXT,                 -- order this turn resolved against, if any
  escalated   INTEGER NOT NULL DEFAULT 0,
  trail_json  TEXT,                 -- decision-tree trail for this turn, for UI + audit
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS escalations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  order_id    TEXT,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- General policy content: NOT order-specific. Used to answer questions like
-- "what's your return policy" or "how long do refunds take" when the
-- customer hasn't given (or doesn't need to give) an order ID.
CREATE TABLE IF NOT EXISTS kb_articles (
  id        TEXT PRIMARY KEY,
  topic     TEXT NOT NULL,        -- short heading shown in the trail/tag
  keywords  TEXT NOT NULL,        -- comma-separated terms used for matching
  answer    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_session ON threads(session_id);
CREATE INDEX IF NOT EXISTS idx_escalations_session ON escalations(session_id);
