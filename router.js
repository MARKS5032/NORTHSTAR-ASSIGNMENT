// lib/router.js
// Turns one raw customer message + the thread's pending state into a bot
// response, by dispatching to the decision trees in decisionTrees.js.

const trees = require('./decisionTrees');

function extractOrderId(text) {
  const m = text.match(/NS[\s-]?\d{3,6}/i);
  return m ? m[0] : null;
}

function detectIntent(text) {
  const t = text.toLowerCase();
  if (/refund/.test(t)) return 'refund';
  if (/(return|send.*back|exchange)/.test(t)) return 'return';
  if (/(track|status|where|order|deliver)/.test(t)) return 'status';
  return null;
}

function detectReasonKey(text) {
  const t = text.toLowerCase();
  if (/^1|defect|damag/.test(t)) return 'Defective / damaged';
  if (/^2|wrong/.test(t)) return 'Wrong item received';
  if (/^3|no longer|don'?t need/.test(t)) return 'No longer needed';
  return 'Other';
}

// Phrasing that means "this is about MY order/transaction" — these need an
// order ID before anything useful can be answered, and must never be routed
// to the general knowledge base (which has no idea which order "my" means).
const SPECIFIC_ORDER_MARKERS =
  /(my order|this order|i ordered|i bought|where(?:'s| is)|track(?:ing)? my|status of my|when will my|cancel my order|refund my|check my refund|return an item|start a return|return my order)/i;

function isOrderSpecific(text, intent) {
  if (SPECIFIC_ORDER_MARKERS.test(text)) return true;
  // "status" has no general/policy meaning on its own — it always needs an order.
  if (intent === 'status') return true;
  return false;
}

/**
 * @param {string} text - the raw customer message
 * @param {{pending_intent: string|null, pending_order_id: string|null}} thread
 * @returns {{reply, escalated, escalationReason, orderId, intent, trail, nextPending: {intent, orderId}|null}}
 */
function route(text, thread) {
  // Mid-flow: the bot is waiting on a return reason for a specific order.
  if (thread.pending_intent === 'return_reason' && thread.pending_order_id) {
    const reasonKey = detectReasonKey(text);
    const result = trees.runReturnReason(thread.pending_order_id, reasonKey);
    return { ...result, nextPending: null };
  }

  const orderId = extractOrderId(text);
  const intent = detectIntent(text);

  // An order ID was given → this is unambiguously an order-specific
  // question. Always resolve it against the database, never the KB.
  if (orderId) {
    const finalIntent = intent || thread.pending_intent || 'status';
    let result;
    if (finalIntent === 'status') result = trees.runOrderStatus(orderId);
    else if (finalIntent === 'return') result = trees.runReturnEligibility(orderId);
    else result = trees.runRefund(orderId);

    const nextPending = result.awaitingReason
      ? { intent: 'return_reason', orderId: result.orderId }
      : null;
    return { ...result, nextPending };
  }

  // No order ID. If the phrasing is clearly about the customer's own
  // order ("my order", "track my...", "status of my..."), don't guess —
  // ask for the order ID rather than answering from the knowledge base.
  if (isOrderSpecific(text, intent)) {
    return {
      reply: "Sure — could you share your order number? It looks like NS1001, NS1002, etc.",
      escalated: false,
      orderId: null,
      intent: intent || 'status',
      trail: [
        { label: '1. Order-specific question, no order ID given', hit: true },
        { label: '2. Ask customer for order ID', hit: true },
      ],
      nextPending: { intent: intent || 'status', orderId: null },
    };
  }

  // Otherwise this reads like a general question about policy — answer
  // from the Northstar Knowledge Base, not the order database.
  const kbResult = trees.runKnowledgeBase(text);
  return { ...kbResult, nextPending: null };
}

module.exports = { route, extractOrderId, detectIntent };
