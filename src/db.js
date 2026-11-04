const fs = require('node:fs');
const { Pool } = require('pg');
require('dotenv').config();

// Certificate verification stays enabled. Never log the database URL.
function createPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Configure your private .env file.');
  const url = new URL(process.env.DATABASE_URL);
  for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    if (url.searchParams.has(name)) throw new Error(`Remove ${name} from DATABASE_URL; TLS is configured in the app.`);
  }
  const ssl = { rejectUnauthorized: true };
  if (process.env.PG_CA_CERT_PATH) ssl.ca = fs.readFileSync(process.env.PG_CA_CERT_PATH, 'utf8');
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
}
const pool = createPool();
module.exports = { pool };
