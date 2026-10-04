/* ==========================================================================
   server/db.js — one shared PostgreSQL connection pool.
   Every query in the app goes through here and uses $1, $2… placeholders
   (parameterized queries), so user input is never glued into SQL text.
   ========================================================================== */
const { Pool, types } = require('pg');
const { DATABASE_URL, DATABASE_SSL } = require('./config');

// By default `pg` turns a DATE column into a JavaScript Date at local midnight,
// which then shifts by a day when serialised to JSON. Horizon's frontend wants
// a plain "YYYY-MM-DD" string, so we keep DATE values as strings (type OID 1082).
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Many managed hosts (Render, Heroku, Supabase…) require SSL. Set DATABASE_SSL=true for them.
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});

// An idle client can error (e.g. the database restarts). Log it instead of crashing.
pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
