const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./db');
async function main() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_initial.sql'), 'utf8');
    await pool.query(sql);
    const mqttSql = fs.readFileSync(path.join(__dirname, '../migrations/002_mqtt.sql'), 'utf8');
    await pool.query(mqttSql);
    console.log('Initial schema is ready.');
  } catch (error) {
    console.error('Migration failed. Check the NEW database connection and permissions; do not share credentials.');
    console.error('Error code:', error.code || 'unknown');
    process.exitCode = 1;
  } finally { await pool.end(); }
}
main();
