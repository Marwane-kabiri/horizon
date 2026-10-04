/* ==========================================================================
   server/config.js — read and validate environment variables in one place.
   If something essential is missing we stop immediately with a clear message
   instead of failing mysteriously later.
   ========================================================================== */
require('dotenv').config();

const PLACEHOLDER_SECRET = 'replace_with_a_long_random_secret';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

function fatal(message) {
  console.error(`\n[config] ${message}\n`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  fatal('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  fatal('SESSION_SECRET is not set. Copy .env.example to .env and generate a random value (see README).');
}
if (SESSION_SECRET === PLACEHOLDER_SECRET) {
  if (isProd) {
    fatal('SESSION_SECRET is still the placeholder value. Generate a real random secret before running in production.');
  }
  console.warn('[config] Warning: SESSION_SECRET is still the placeholder from .env.example. Change it before deploying.');
}
if (isProd && SESSION_SECRET.length < 32) {
  fatal('SESSION_SECRET must be at least 32 characters in production.');
}

const COOKIE_NAME = 'horizon.sid';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Cookie settings explained:
//   httpOnly -> JavaScript in the page can never read the cookie (blocks XSS theft)
//   sameSite -> the browser will not attach it to cross-site POST/PUT/DELETE requests
//   secure   -> only sent over HTTPS (switched on in production)
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  maxAge: SESSION_MAX_AGE_MS,
  path: '/',
};

module.exports = {
  NODE_ENV,
  isProd,
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  SESSION_SECRET,
  COOKIE_NAME,
  cookieOptions,
};
