// lib/decisionTrees.js
// Implements the three support decision trees. Every fact about an order
// (status, product, expected delivery, tracking, location, payment,
// notes) is read from orderRepository — nothing here is ever invented.

const { getOrderById } = require('./orderRepository');
const { searchKnowledgeBase } = require('./knowledgeBaseRepository');

const NOT_FOUND_REPLY = (rawId) =>
  `I couldn't find an order matching "${rawId}" in our system. Could you double-check the order ID? ` +
  `It should look like NS1001. If you're sure it's correct, I've flagged this for a support agent to check manually.`;

// Builds the customer-facing order-status reply. Every fact used here comes
// straight off the `order` row from the database — nothing is invented.
// When a field the sentence would need (tracking number, notes) is missing
// or null in the database, the reply says so explicitly instead of guessing.
function buildOrderStatusReply(order) {
  const notesLine = order.notes ? ` Note on file: "${order.notes}".` : '';

  switch (order.status) {
    case 'Processing':
      return `Order ${order.id} (${order.product}) is currently being prepared — it's in our warehouse queue and hasn't shipped yet. Expected delivery: ${order.expected_delivery}.`;

    case 'Shipped': {
      const trackingLine = order.tracking_number
        ? ` Tracking number: ${order.tracking_number}.`
        : ' A tracking number hasn\'t been assigned in our system yet — I\'ll have nothing further to add until it is.';
      return `Order ${order.id} (${order.product}) has been dispatched and is on its way to ${order.delivery_location}.${trackingLine} Expected delivery: ${order.expected_delivery}.`;
    }

    case 'Out for Delivery':
      return `Order ${order.id} (${order.product}) is currently out for delivery in ${order.delivery_location} and should arrive today.${order.tracking_number ? ` Tracking number: ${order.tracking_number}.` : ''}`;

    case 'Delivered':
      return `Confirming: order ${order.id} (${order.product}) has been delivered.${notesLine} Let me know if it didn't actually arrive and I'll escalate this right away.`;

    case 'Delayed':
      return `I'm sorry — order ${order.id} (${order.product}) is delayed.${notesLine || ' We don\'t have a specific reason logged yet.'}${order.tracking_number ? ` Tracking number: ${order.tracking_number}.` : ''} We'll update the estimate as soon as the courier reports back.`;

    case 'Cancelled': {
      let refundLine;
      if (order.payment_status === 'Refunded') {
        refundLine = ' Your payment has already been refunded to your original payment method.';
      } else if (order.payment_status === 'Paid') {
        refundLine = ' Your refund is being processed and should post within 5–7 business days.';
      } else {
        refundLine = ` Payment status on file: ${order.payment_status}.`;
      }
      return `Order ${order.id} (${order.product}) was cancelled.${notesLine}${refundLine}`;
    }

    default:
      return null;
  }
}

// ---------- 1. ORDER STATUS TREE ----------
function runOrderStatus(rawOrderId) {
  const trail = [
    { label: '1. Order number received', hit: true },
  ];
  const order = getOrderById(rawOrderId);
  trail.push({ label: '2. Validate against order database', hit: !!order });

  if (!order) {
    trail.push({ label: '3. Not found in database → escalate', hit: true, escalated: true });
    return {
      reply: NOT_FOUND_REPLY(rawOrderId),
      escalated: true,
      escalationReason: 'Order ID not found in database',
      orderId: null,
      intent: 'status',
      trail,
    };
  }

  trail.push({ label: `3. Retrieve current status: ${order.status}`, hit: true });
  trail.push({ label: '4. Map status → customer response', hit: true });

  const reply = buildOrderStatusReply(order);

  if (!reply) {
    trail.push({ label: `5. Unrecognized status "${order.status}" → escalate`, hit: true, escalated: true });
    return {
      reply: `Order ${order.id} has a status in our system I don't have a scripted response for. I've escalated this to a human agent.`,
      escalated: true,
      escalationReason: `Unrecognized status value: ${order.status}`,
      orderId: order.id,
      intent: 'status',
      trail,
    };
  }

  trail.push({ label: '5. Response delivered to customer', hit: true });
  return { reply, escalated: false, orderId: order.id, intent: 'status', trail };
}

// ---------- 2. RETURN TREE ----------
function runReturnEligibility(rawOrderId) {
  const trail = [{ label: '1. Return requested', hit: true }];
  const order = getOrderById(rawOrderId);
  trail.push({ label: '2. Validate against order database', hit: !!order });

  if (!order) {
    trail.push({ label: '3. Not found → escalate', hit: true, escalated: true });
    return {
      reply: NOT_FOUND_REPLY(rawOrderId),
      escalated: true,
      escalationReason: 'Return requested on order ID not found in database',
      orderId: null,
      intent: 'return',
      trail,
      awaitingReason: false,
    };
  }

  trail.push({ label: `3. Check eligibility flag: ${order.return_eligible}`, hit: true });

  if (order.return_eligible !== 'Yes') {
    if (order.status !== 'Delivered') {
      trail.push({ label: '4. Not delivered yet → not eligible', hit: true });
      return {
        reply: `Order ${order.id} hasn't been delivered yet (current status: ${order.status}), so a return can't be started. Once it arrives you'll have a return window — just message us again.`,
        escalated: false,
        orderId: order.id,
        intent: 'return',
        trail,
        awaitingReason: false,
      };
    }
    trail.push({ label: '4. Outside return window → not eligible', hit: true });
    trail.push({ label: '5. Dispute path → escalate', hit: true, escalated: true });
    return {
      reply: `Order ${order.id} is marked outside our return window. I've flagged this for a support agent in case there's a special circumstance — they'll follow up.`,
      escalated: true,
      escalationReason: 'Customer disputes return-window denial',
      orderId: order.id,
      intent: 'return',
      trail,
      awaitingReason: false,
    };
  }

  trail.push({ label: '4. Eligible → ask return reason', hit: true });
  return {
    reply: `Good news — order ${order.id} (${order.product}) is eligible for return. What's the reason?\n\n1) Defective / damaged\n2) Wrong item received\n3) No longer needed\n4) Other`,
    escalated: false,
    orderId: order.id,
    intent: 'return',
    trail,
    awaitingReason: true,
  };
}

function runReturnReason(rawOrderId, reasonKey) {
  const order = getOrderById(rawOrderId);
  const trail = [
    { label: '1. Return requested', hit: true },
    { label: '2. Validate against order database', hit: !!order },
  ];

  if (!order) {
    trail.push({ label: '3. Not found → escalate', hit: true, escalated: true });
    return {
      reply: NOT_FOUND_REPLY(rawOrderId),
      escalated: true,
      escalationReason: 'Order ID not found in database',
      orderId: null,
      intent: 'return',
      trail,
    };
  }

  trail.push({ label: '3. Eligibility flag: Yes', hit: true });
  trail.push({ label: `4. Reason: ${reasonKey}`, hit: true });

  if (reasonKey === 'Defective / damaged' || reasonKey === 'Wrong item received') {
    trail.push({ label: '5. Expedited path → instructions sent', hit: true });
    return {
      reply: `Sorry about that. For order ${order.id}, I'm sending a prepaid return label to your email — no restocking fee. Drop the package at any Northstar partner location, and your refund will be issued within 5–7 business days of us receiving it.`,
      escalated: false,
      orderId: order.id,
      intent: 'return',
      trail,
    };
  }
  if (reasonKey === 'No longer needed') {
    trail.push({ label: '5. Standard path → instructions sent', hit: true });
    return {
      reply: `No problem. For order ${order.id}, print the return label from your order page and drop the package off within 14 days. Return shipping is customer-paid for this reason. Refund posts 5–7 business days after we receive it.`,
      escalated: false,
      orderId: order.id,
      intent: 'return',
      trail,
    };
  }

  trail.push({ label: '5. Reason needs review → escalate', hit: true, escalated: true });
  return {
    reply: `Got it — since the reason doesn't fit our standard categories, I've sent this to a support agent who'll follow up with return instructions.`,
    escalated: true,
    escalationReason: "Return reason 'Other' — needs human review",
    orderId: order.id,
    intent: 'return',
    trail,
  };
}

// ---------- 3. REFUND TREE ----------
function runRefund(rawOrderId) {
  const trail = [{ label: '1. Refund question received', hit: true }];
  const order = getOrderById(rawOrderId);
  trail.push({ label: '2. Validate against order database', hit: !!order });

  if (!order) {
    trail.push({ label: '3. Not found → escalate', hit: true, escalated: true });
    return {
      reply: NOT_FOUND_REPLY(rawOrderId),
      escalated: true,
      escalationReason: 'Refund question on order ID not found in database',
      orderId: null,
      intent: 'refund',
      trail,
    };
  }

  const requested = order.status === 'Cancelled' || order.return_eligible === 'Yes';
  trail.push({ label: `3. Refund/return requested? ${requested ? 'Yes' : 'No'}`, hit: true });

  if (order.payment_status === 'Refunded') {
    trail.push({ label: '4. Refund status: Completed', hit: true });
    return {
      reply: `Refund for order ${order.id} is complete — it's already been processed to your original payment method.`,
      escalated: false,
      orderId: order.id,
      intent: 'refund',
      trail,
    };
  }

  if (order.status === 'Cancelled' && order.payment_status === 'Paid') {
    trail.push({ label: '4. Refund status: Pending', hit: true });
    return {
      reply: `Order ${order.id} was cancelled and the refund is pending — it typically posts within 5–7 business days.`,
      escalated: false,
      orderId: order.id,
      intent: 'refund',
      trail,
    };
  }

  if (order.return_eligible === 'Yes') {
    trail.push({ label: '4. No refund yet — return not started', hit: true });
    return {
      reply: `No refund has been initiated for order ${order.id} yet, since a return hasn't been started. Want me to start one now? Just say "return ${order.id}".`,
      escalated: false,
      orderId: order.id,
      intent: 'refund',
      trail,
    };
  }

  trail.push({ label: '4. Refund status: Rejected / not applicable', hit: true });
  trail.push({ label: '5. Customer disputes → escalate', hit: true, escalated: true });
  return {
    reply: `There's no refund on file for order ${order.id} — it isn't marked as cancelled or return-eligible. I've sent this to a support agent in case something's missing.`,
    escalated: true,
    escalationReason: 'Refund not applicable — order not eligible or not cancelled',
    orderId: order.id,
    intent: 'refund',
    trail,
  };
}

// ---------- 4. KNOWLEDGE BASE (general policy questions) ----------
// For questions that are about policy in general, not about one order —
// "what's your return policy", "how long do refunds take", etc. Answered
// from kb_articles, never from the orders table, and never invented.
function runKnowledgeBase(text) {
  const trail = [
    { label: '1. General policy question detected', hit: true },
    { label: '2. Search Northstar Knowledge Base', hit: true },
  ];
  const article = searchKnowledgeBase(text);

  if (!article) {
    trail.push({ label: '3. No matching KB article → escalate', hit: true, escalated: true });
    return {
      reply:
        "I don't have a scripted answer for that in our knowledge base. I've sent this to a support agent who can help — " +
        'if it turns out to be about a specific order, the order ID will help them move faster.',
      escalated: true,
      escalationReason: `No KB article matched: "${text}"`,
      orderId: null,
      intent: 'kb',
      trail,
    };
  }

  trail.push({ label: `3. Matched article: ${article.topic}`, hit: true });

  // The "talk to a human" article promises the customer it's been logged —
  // make that true rather than just saying it.
  if (article.id === 'kb-contact') {
    trail.push({ label: '4. Explicit human-agent request → escalate', hit: true, escalated: true });
    return {
      reply: article.answer,
      escalated: true,
      escalationReason: 'Customer explicitly asked to speak with a human agent',
      orderId: null,
      intent: 'kb',
      trail,
    };
  }

  trail.push({ label: '4. Response delivered to customer', hit: true });
  return {
    reply: article.answer,
    escalated: false,
    orderId: null,
    intent: 'kb',
    trail,
  };
}

module.exports = {
  runOrderStatus,
  runReturnEligibility,
  runReturnReason,
  runRefund,
  runKnowledgeBase,
  NOT_FOUND_REPLY,
};
