/* ==========================================================================
   server/server.js — Horizon web server.

   One Express app does everything:
     - serves the frontend from /public
     - exposes the JSON API under /api
     - keeps login sessions in PostgreSQL
   Because the page and the API share one origin, no CORS setup is needed.
   ========================================================================== */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const config = require('./config'); // validates .env first — keep this near the top
const { pool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const { sameOriginOnly, noStore } = require('./middleware/security');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const { ValidationError } = require('./utils/validate');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const app = express();

// On hosts like Render/Heroku/Railway the app sits behind a proxy that terminates
// HTTPS. This lets Express see the real client IP (for rate limiting) and know
// the connection was secure (for the Secure cookie).
if (config.isProd) app.set('trust proxy', 1);

/* ---------- security headers ---------- */
// Helmet's default Content-Security-Policy is strict. We only loosen what Horizon
// needs: Google Fonts, and inline style="" attributes (the UI sets category colours
// that way). Scripts stay locked to our own files.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'style-src': ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      // Upgrading http->https only makes sense in production (it breaks Safari on http://localhost).
      'upgrade-insecure-requests': config.isProd ? [] : null,
    },
  },
}));

/* ---------- frontend (static files) ---------- */
// Mounted before the session middleware so CSS/JS requests never touch the database.
app.use(express.static(PUBLIC_DIR));

/* ---------- API ---------- */
app.use(
  '/api',
  express.json({ limit: '10kb' }),
  session({
    name: config.COOKIE_NAME,
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // no cookie until someone actually logs in
    rolling: true,            // active users stay logged in; the 7 days restart on each request
    store: new PgSession({ pool, tableName: 'session' }),
    cookie: config.cookieOptions,
  }),
  noStore,
  sameOriginOnly
);

app.use('/api/auth', authRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

/* ---------- error handling ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  // 23503 = foreign_key_violation: the session points at a user that no longer exists.
  if (err.code === '23503') return res.status(401).json({ error: 'Your session is no longer valid. Please log in again.' });

  // Log details on the server only. The browser just gets a generic message.
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

/* ---------- startup ---------- */
async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('\n[startup] Could not connect to PostgreSQL:', err.message);
    console.error('[startup] Check DATABASE_URL in your .env file and that PostgreSQL is running.\n');
    process.exit(1);
  }

  const { rows } = await pool.query(
    `SELECT to_regclass('public.users') AS users,
            to_regclass('public.tasks') AS tasks,
            to_regclass('public.session') AS session`
  );
  if (!rows[0].users || !rows[0].tasks || !rows[0].session) {
    console.error('\n[startup] Database tables are missing. Run:  npm run db:init\n');
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    console.log(`Horizon is running at http://localhost:${config.PORT}  (${config.NODE_ENV})`);
  });

  const shutdown = () => {
    console.log('\nShutting down…');
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
