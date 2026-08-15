// seed.js
// Builds northstar.db from schema.sql in the root folder and populates initial orders.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'northstar.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Option to recreate a clean database if needed
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

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
  INSERT INTO orders (
    id, customer_name, product, order_date, expected_delivery, 
    status, tracking_number, delivery_location, payment_status, return_eligible, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

const insertMany = db.transaction((orders) => {
  for (const order of orders) {
    upsert.run(...order);
  }
});

insertMany(ORDERS);

console.log('Database successfully seeded at northstar.db');
