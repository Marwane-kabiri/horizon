/* ==========================================================================
   database/init.js — run database/schema.sql using the pg driver.

   Usage:  npm run db:init

   This exists so you do not need the `psql` command-line tool installed
   (handy on Windows). It reads DATABASE_URL from your .env file.
   ========================================================================== */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in first.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    // With no query parameters, pg lets us send several statements at once.
    await pool.query(sql);
    console.log('Database schema is ready (users, tasks, session).');
  } catch (err) {
    console.error('Could not initialise the database:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
