// routes/orders.js
const express = require('express');
const { getOrderById, toCustomerView } = require('./orderRepository');

const router = express.Router();

// GET /api/orders/:id — used by the frontend for a raw lookup, and handy
// for curl/Postman testing that the DB is really the source of truth.
router.get('/:id', (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({
      found: false,
      message: `No order found matching "${req.params.id}". Please verify the order ID.`,
    });
  }
  res.json({ found: true, order: toCustomerView(order) });
});

module.exports = router;
