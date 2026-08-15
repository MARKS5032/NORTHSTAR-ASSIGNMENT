// db/seed.js
// Builds db/northstar.db from schema.sql and loads it with the exact rows
// transcribed from Demo_Order_Database.pdf. This is the ONLY place order
// data enters the system — the app never fabricates or edits these fields.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'northstar.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Transcribed verbatim from Demo_Order_Database.pdf.
// tracking_number is NULL where the sheet shows "-" (not yet dispatched).
const ORDERS = [
  ['NS1001','Amina Wanjiku','Wireless Headphones','2026-08-10','2026-08-15','Processing',null,'Nairobi','Paid','No','Order is being prepared for dispatch'],
  ['NS1002','Brian Otieno','Running Shoes','2026-08-08','2026-08-14','Shipped','NS-TRK-1002','Kisumu','Paid','No','Package has left the warehouse'],
  ['NS1003','Carol Njeri','Smart Watch','2026-08-06','2026-08-13','Out for Delivery','NS-TRK-1003','Nairobi','Paid','No','Expected to arrive today'],
  ['NS1004','David Kamau','Laptop Backpack','2026-08-03','2026-08-09','Delivered','NS-TRK-1004','Kiambu','Paid','Yes','Delivered successfully'],
  ['NS1005','Esther Akinyi','Bluetooth Speaker','2026-08-01','2026-08-07','Delayed','NS-TRK-1005','Mombasa','Paid','Yes','Delivery delayed due to courier issue'],
  ['NS1006','Felix Mwangi','USB-C Charger','2026-08-05','2026-08-12','Cancelled',null,'Nakuru','Refunded','No','Customer cancellation requested'],
  ['NS1007','Grace Wambui','Office chair','2026-08-04','2026-08-11','Shipped','NS-TRK-007','Nairobi','Paid','No','In transit'],
  ['NS1008','Hassan Ali','Coffee Maker','2026-07-25','2026-07-30','Delivered','NS-TRK-008','Mombasa','Paid','Yes','Delivered and within return window'],
  ['NS1009','Irene Chebet','Fitness Tracker','2026-07-20','2026-07-25','Delivered','NS-TRK-009','Eldoret','Paid','Yes','Customer may request a return'],
  ['NS1010','James Kariuki','Mechanical Keyboard','2026-08-11','2026-08-16','Processing',null,'Thika','Paid','No','Awaiting warehouse processing'],
  ['NS1011','Lucy Atieno','Tablet Stand','2026-08-07','2026-08-13','Delayed','NS-TRK1011','Kisumu','Paid','No','Courier reported a delivery delay'],
  ['NS1012','Mark Ochieng','Power Bank','2026-08-09','2026-08-15','Shipped','NS-TRK1012','Nairobi','Paid','No','Package dispatched'],
];

const upsert = db.prepare(`
  INSERT INTO orders (id, customer_name, product, order_date, expected_delivery, status, tracking_number, delivery_location, payment_status, return_eligible, notes)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    customer_name=excluded.customer_name,
    product=excluded.product,
    order_date=excluded.order_date,
    expected_delivery=excluded.expected_delivery,
    status=excluded.status,
    tracking_number=excluded.tracking_number,
    delivery_location=excluded.delivery_location,
    payment_status=excluded.payment_status,
    return_eligible=excluded.return_eligible,
    notes=excluded.notes
`);

const insertAll = db.transaction((rows) => {
  for (const row of rows) upsert.run(...row);
});

insertAll(ORDERS);

// Northstar Knowledge Base — general policy content, not tied to any order.
// This is what general returns/refunds/company-policy questions are
// answered from, separately from the per-order database above.
const KB_ARTICLES = [
  ['kb-return-window', 'Return Policy',
    'return policy,return window,how long to return,days to return,return items,can i return',
    'Most items can be returned within 14 days of delivery, provided they\'re unused and in original packaging. Eligibility is checked per order — share your order ID and I can confirm whether that specific item qualifies.'],
  ['kb-return-how', 'How to Return an Item',
    'how do i return,how to return,return process,return label,drop off return',
    'To return an eligible item: we email a prepaid or standard return label depending on the reason, you drop the package at any Northstar partner location, and the refund posts once we receive it. Share your order ID and I can start this for you.'],
  ['kb-refund-timeline', 'Refund Timelines',
    'refund policy,how long refund,when will i get my refund,refund timeline,how long does a refund take',
    'Refunds are issued to your original payment method within 5–7 business days after we receive a returned item, or within 5–7 business days of a cancellation being processed. Share your order ID and I can check where a specific refund stands.'],
  ['kb-exchange', 'Exchanges',
    'exchange,swap item,different size,different color',
    'We don\'t process direct exchanges — the fastest path is to return the original item for a refund and place a new order for the item you want. Share your order ID if you\'d like help starting a return.'],
  ['kb-cancellation', 'Order Cancellation Policy',
    'cancel order,cancellation policy,can i cancel,how to cancel',
    'Orders can be cancelled while they\'re still in "Processing" status, before they\'ve shipped. Once an order ships, it can\'t be cancelled — a return after delivery is the next option. Share your order ID and I can check which stage it\'s at.'],
  ['kb-damaged', 'Damaged or Defective Items',
    'damaged,defective,broken,arrived broken,wrong item,item missing parts',
    'Damaged, defective, or incorrect items are returned free of charge with an expedited prepaid label and no restocking fee. Share your order ID and describe the issue and I\'ll get that started.'],
  ['kb-shipping', 'Shipping & Delivery',
    'shipping policy,delivery time,how long does shipping take,shipping cost,delivery options',
    'Standard delivery typically takes 5–7 days from the order date, depending on destination. Exact timing for a specific order — including tracking — is available if you share the order ID.'],
  ['kb-payment', 'Payment Methods',
    'payment methods,how can i pay,accepted payment,pay on delivery',
    'Northstar accepts major cards and mobile payment on checkout; order-level payment status (paid, refunded) is tracked per order — share your order ID if you want that confirmed.'],
  ['kb-contact', 'Contact a Human Agent',
    'talk to a human,speak to agent,human support,real person,contact support',
    'I can escalate this to a support agent right away — I\'ve logged it in the escalation queue and someone will follow up. If it\'s about a specific order, sharing the order ID helps them jump in faster.'],
];

const upsertKb = db.prepare(`
  INSERT INTO kb_articles (id, topic, keywords, answer) VALUES (?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET topic=excluded.topic, keywords=excluded.keywords, answer=excluded.answer
`);
const insertAllKb = db.transaction((rows) => {
  for (const row of rows) upsertKb.run(...row);
});
insertAllKb(KB_ARTICLES);

console.log(`Seeded ${ORDERS.length} orders and ${KB_ARTICLES.length} knowledge base articles into ${DB_PATH}`);
db.close();
