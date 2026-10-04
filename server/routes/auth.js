/* ==========================================================================
   server/routes/auth.js — register, login, logout, current user.
   Mounted at /api/auth
   ========================================================================== */
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const { pool, query } = require('../db');
const { COOKIE_NAME, cookieOptions, isProd } = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { toPublicUser } = require('../utils/serialize');
const { insertSeedTasks } = require('../utils/seedTasks');
const { ValidationError, validateEmail, validatePassword } = require('../utils/validate');

const router = express.Router();
const BCRYPT_ROUNDS = 12;

/* ---------- rate limiting (brute-force protection) ---------- */
// Failed logins: 10 per 15 minutes per IP. Successful logins don't count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});
// Account creation: 10 per hour per IP (relaxed in development so test runs aren't blocked).
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isProd ? 10 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-up attempts. Please try again later.' },
});

/* ---------- helpers ---------- */

// Used when the email doesn't exist, so "unknown email" and "wrong password"
// take the same amount of time (prevents guessing which emails are registered).
let dummyHash;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);
  return dummyHash;
}

// Start a fresh session for this user. regenerate() issues a NEW session id,
// which prevents "session fixation" attacks. save() makes sure the row is in
// PostgreSQL before we answer, so the very next request is already logged in.
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

function endSession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

/* ---------- POST /api/auth/register ---------- */
router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);
  // The API example only sends email + password, so confirmPassword is optional,
  // but if the client sends it, it must match.
  if (body.confirmPassword !== undefined && body.confirmPassword !== password) {
    throw new ValidationError('Passwords do not match.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create the user and their example tasks in ONE transaction:
  // either both exist afterwards, or neither does.
  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );
    user = result.rows[0];
    await insertSeedTasks(client, user.id);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // 23505 = unique_violation: that email is already registered.
    // (Relying on the database constraint avoids a check-then-insert race.)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw err;
  } finally {
    client.release();
  }

  await startSession(req, user.id);
  res.status(201).json({ user: toPublicUser(user) });
}));

/* ---------- POST /api/auth/login ---------- */
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email || !body.password) {
    throw new ValidationError('Email and password are required.');
  }

  const email = body.email.trim().toLowerCase();
  const { rows } = await query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];

  const passwordMatches = await bcrypt.compare(body.password, user ? user.password_hash : await getDummyHash());
  if (!user || !passwordMatches) {
    // Same message either way — don't reveal which part was wrong.
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  await startSession(req, user.id);
  res.json({ user: toPublicUser(user) });
}));

/* ---------- POST /api/auth/logout ---------- */
router.post('/logout', asyncHandler(async (req, res) => {
  await endSession(req); // deletes the session row, so the old cookie is useless
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ success: true });
}));

/* ---------- GET /api/auth/me ---------- */
router.get('/me', asyncHandler(async (req, res) => {
  const userId = req.session && req.session.userId;
  if (!userId) return res.json({ authenticated: false });

  const { rows } = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
  if (!rows[0]) {
    // The account was deleted while the session was still alive.
    await endSession(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, user: toPublicUser(rows[0]) });
}));

module.exports = router;
