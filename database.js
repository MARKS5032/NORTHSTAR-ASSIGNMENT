const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Looks for northstar.db in the current root directory
const DB_PATH = path.join(__dirname, 'northstar.db');

if (!fs.existsSync(DB_PATH)) {
  throw new Error(
    `Database not found at ${DB_PATH}. Run "npm run seed" first to create it from schema.sql.`
  );
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

module.exports = db;
