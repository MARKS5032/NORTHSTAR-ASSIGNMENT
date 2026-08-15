const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, 'northstar.db');

// Auto-run seed script if northstar.db doesn't exist yet
if (!fs.existsSync(DB_PATH)) {
  console.log('northstar.db not found. Running seed script...');
  execSync('node seed.js', { stdio: 'inherit' });
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

module.exports = db;
