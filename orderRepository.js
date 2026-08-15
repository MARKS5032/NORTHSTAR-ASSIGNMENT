// lib/orderRepository.js
// Every code path that needs order data must go through here. This is the
// enforcement point for "the database is the source of truth": if a row
// isn't in the orders table, this returns null and callers must not guess.

const db = require('./database');

const getByIdStmt = db.prepare('SELECT * FROM orders WHERE id = ?');

/**
 * Normalize a raw, possibly messy customer-typed order reference
 * (e.g. "ns 1005", "NS-1005", "ns1005") into the canonical id format used
 * in the database (e.g. "NS1005"). Returns null if it doesn't even look
 * like an order id, so callers can short-circuit before hitting the DB.
 */
function normalizeOrderId(raw) {
  if (!raw) return null;
  const cleaned = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = cleaned.match(/^NS\d{3,6}$/);
  return match ? match[0] : null;
}

/**
 * Looks up a single order by id. Returns the raw DB row (or null).
 * This is the ONLY function allowed to answer "what is this order's status".
 */
function getOrderById(rawId) {
  const id = normalizeOrderId(rawId);
  if (!id) return null;
  const row = getByIdStmt.get(id);
  return row || null;
}

function toCustomerView(order) {
  if (!order) return null;
  return {
    orderId: order.id,
    product: order.product,
    status: order.status,
    expectedDelivery: order.expected_delivery,
    trackingNumber: order.tracking_number, // may be null — never fabricate one
    deliveryLocation: order.delivery_location,
    paymentStatus: order.payment_status,
    returnEligible: order.return_eligible === 'Yes',
    notes: order.notes,
  };
}

module.exports = { normalizeOrderId, getOrderById, toCustomerView };
