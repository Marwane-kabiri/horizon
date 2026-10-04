# Horizon — task manager organized by time horizon

Horizon lets you organize work by *when* it matters — Today, Tomorrow, This week … all the way to long-term goals.
This version is a **real multi-user full-stack app**: accounts, login sessions, and tasks all live on a server and
in a PostgreSQL database, so your tasks follow you to any browser or device.

---

## Features

- Create an account, log in, log out (passwords hashed with **bcrypt**)
- Every user sees **only their own tasks** — enforced on the server, not just in the UI
- Create, edit, delete, complete/uncomplete tasks
- Move tasks between 8 time horizons (dropdown or drag & drop)
- Search, filter by status/priority, sort, stats dashboard, progress ring (all client-side, instant)
- Dark / light theme, collapsible sections (stored in `localStorage` — these are just UI preferences)
- New accounts get 8 example tasks, **once**, at sign-up
- Loading states, error toasts, and an "Your session has expired" flow

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | HTML, CSS, vanilla JavaScript (no framework) |
| Backend   | Node.js + Express |
| Database  | PostgreSQL (`pg` driver) |
| Auth      | `express-session` + `connect-pg-simple` (sessions stored in PostgreSQL), HTTP-only cookie, `bcrypt` |
| Hardening | `helmet`, `express-rate-limit`, parameterized SQL, server-side validation |

## Project structure

```text
horizon/
├── public/                    # the frontend (served by Express)
│   ├── index.html
│   ├── style.css
│   └── script.js
├── server/
│   ├── server.js              # app setup: security headers, sessions, routes, error handler
│   ├── config.js              # reads + validates .env
│   ├── db.js                  # PostgreSQL connection pool
│   ├── middleware/
│   │   ├── auth.js            # requireAuth — blocks anonymous requests
│   │   └── security.js        # same-origin (CSRF) check, no-store caching
│   ├── routes/
│   │   ├── auth.js            # /api/auth/*  (register, login, logout, me)
│   │   └── tasks.js           # /api/tasks/* (CRUD, always scoped to the logged-in user)
│   └── utils/
│       ├── validate.js        # all input validation
│       ├── seedTasks.js       # example tasks for new accounts
│       ├── serialize.js       # DB row -> the object shape the frontend uses
│       └── asyncHandler.js
├── database/
│   ├── schema.sql             # tables + indexes (safe to re-run)
│   └── init.js                # runs schema.sql for you:  npm run db:init
├── tests/
│   ├── validate.test.js       # unit tests (no DB needed)
│   └── api-security.test.js   # end-to-end user-isolation tests (needs the running app)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## How it fits together

```text
 Browser (public/)                     Express server                    PostgreSQL
 ─────────────────                     ──────────────                    ──────────
 script.js ── fetch("/api/...") ──►  session middleware  ◄── reads ──►  session table
   (sends the cookie                   │ who is this?
    automatically)                     ▼
                                     requireAuth ──► routes/tasks.js ──►  tasks table
                                                     WHERE user_id = <session user>
```

One Express app serves both the page and the API on the same origin, so there is no CORS setup.

---

## Setup — step by step

You need **Node.js 18 or newer** and **PostgreSQL 13 or newer**.

### 1. Install PostgreSQL

- **macOS:** `brew install postgresql@16 && brew services start postgresql@16`
- **Ubuntu/Debian:** `sudo apt install postgresql && sudo service postgresql start`
- **Windows:** download the installer from <https://www.postgresql.org/download/windows/> (remember the password you set for the `postgres` user)

### 2. Create the database

Open a PostgreSQL shell (`psql -U postgres`, or `sudo -u postgres psql` on Linux) and run:

```sql
CREATE USER horizon_user WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE horizon OWNER horizon_user;
\q
```

### 3. Install the project's dependencies

```bash
cd horizon
npm install
```

### 4. Configure environment variables

```bash
cp .env.example .env        # Windows PowerShell: copy .env.example .env
```

Open `.env` and set:

| Variable | Meaning |
|----------|---------|
| `PORT` | Port the server listens on (default `3000`) |
| `NODE_ENV` | `development` locally, `production` when deployed |
| `DATABASE_URL` | `postgresql://horizon_user:choose-a-strong-password@localhost:5432/horizon` — if the password contains symbols like `@` or `/`, URL-encode them (`@` → `%40`) |
| `DATABASE_SSL` | `true` if your hosting provider requires SSL for the database, otherwise `false` |
| `SESSION_SECRET` | A long random string that signs the session cookie. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

> `.env` holds secrets. It is listed in `.gitignore` — never commit it.

### 5. Create the tables

```bash
npm run db:init
```

This runs `database/schema.sql` (creates `users`, `tasks` and `session`). It is safe to run again.
If you prefer `psql`: `psql "$DATABASE_URL" -f database/schema.sql`

### 6. Start the app

```bash
npm start          # or: npm run dev   (auto-restarts when you edit server files)
```

### 7. Open it

Go to **<http://localhost:3000>**, click **Create an account**, and you're in.

---

## API reference

All request and response bodies are JSON. Errors always look like `{ "error": "message" }`.

### Auth — `/api/auth`

| Method | Path | Body | Success | Notes |
|--------|------|------|---------|-------|
| POST | `/register` | `{ email, password, confirmPassword? }` | `201 { user }` | Logs you in. `409` if the email exists. Password ≥ 8 chars. Creates 8 example tasks. |
| POST | `/login` | `{ email, password }` | `200 { user }` | `401` with the same message for wrong password and unknown email |
| POST | `/logout` | – | `200 { success: true }` | Deletes the session on the server |
| GET | `/me` | – | `200 { authenticated: true, user }` or `{ authenticated: false }` | Never returns 401 |

`user` is always `{ id, email }` — never a password or hash.

### Tasks — `/api/tasks` (login required, otherwise `401`)

| Method | Path | Body | Success |
|--------|------|------|---------|
| GET | `/` | – | `200 { tasks: [...] }` — only the logged-in user's tasks |
| POST | `/` | `{ title, category, description?, dueDate?, priority? }` | `201 { task }` |
| PUT | `/:id` | any of `title, description, dueDate, priority, category, completed` | `200 { task }` |
| DELETE | `/:id` | – | `200 { deleted: true, id }` |

A task looks like:

```json
{
  "id": "0b6c…", "title": "Finish project", "description": "Complete backend",
  "dueDate": "2026-10-05", "priority": "high", "category": "today",
  "completed": false, "createdDate": "2026-10-03T09:12:00.000Z", "completedDate": null
}
```

Valid `priority`: `low` `medium` `high` `critical`.
Valid `category`: `today` `tomorrow` `thisWeek` `nextWeek` `thisMonth` `nextMonth` `thisYear` `longTerm`.

Status codes: `400` validation · `401` not logged in · `404` task not found *(also returned for someone else's task — see below)* · `409` duplicate email · `429` too many attempts · `500` server error.

---

## How authentication works

1. **Register / log in** — the server checks the password with bcrypt, then creates a session row in PostgreSQL and
   sends the browser a cookie named `horizon.sid` containing only a random, signed session id.
2. **Every later request** — the browser attaches that cookie automatically (`credentials: "include"`). The session
   middleware looks the id up and sets `req.session.userId`.
3. **Protected routes** — `requireAuth` rejects the request with `401` if there is no `userId`.
4. **Log out** — the session row is deleted, so the old cookie is worthless even if someone kept a copy.
5. **Expired session** — the next API call returns `401`; the frontend clears its data and shows the login screen with
   *"Your session has expired. Please log in again."*

The cookie is **HttpOnly** (JavaScript can't read it), **SameSite=Lax**, and **Secure** in production. Sessions last 7 days
of activity. No tokens, passwords or tasks are stored in `localStorage`.

## How one user is kept away from another's data

The task owner is **never** taken from the request. Every task query uses the id from the server-side session:

```sql
SELECT … FROM tasks WHERE user_id = $1;                     -- list
UPDATE tasks SET … WHERE id = $n AND user_id = $m …;        -- update
DELETE FROM tasks WHERE id = $1 AND user_id = $2;           -- delete
```

So changing a task id in the browser just matches zero rows. When that happens the API answers `404 Task not found` — the
same answer as for an id that doesn't exist — so an attacker can't even learn whether another user's id is real.
Any `user_id` a client sends in a body is ignored (the validator only passes through a whitelist of fields).

## Security checklist

| Requirement | Where |
|-------------|-------|
| bcrypt (12 rounds), no plaintext passwords | `routes/auth.js` |
| Login timing is the same for unknown emails | dummy hash in `routes/auth.js` |
| Passwords > 72 bytes rejected (bcrypt would silently truncate) | `utils/validate.js` |
| HTTP-only, SameSite, Secure-in-production cookie; new session id on login | `config.js`, `routes/auth.js` |
| Secret only in environment variables; app refuses to start without it | `config.js` |
| `helmet` security headers + Content-Security-Policy | `server.js` |
| Rate limits: 10 failed logins / 15 min, 10 sign-ups / hour (per IP) | `routes/auth.js` |
| Parameterized SQL only; update columns come from a fixed whitelist | `routes/tasks.js` |
| Server-side validation of every field | `utils/validate.js` |
| DB `CHECK` constraints on priority/category, `ON DELETE CASCADE` | `database/schema.sql` |
| Cross-origin write requests rejected (on top of SameSite) | `middleware/security.js` |
| Errors logged on the server; browser gets a generic message | `server.js` |
| `no-store` caching on API responses | `middleware/security.js` |

---

## Testing

### Unit tests (no database needed)

```bash
npm test
```

### Security / isolation tests (the six scenarios from the brief + extras)

Start the app (`npm start`), then in a second terminal:

```bash
npm run test:api
# different address?  BASE_URL=http://localhost:4000 npm run test:api
```

It covers: register A → task A visible · logout, user B doesn't see A's task · B's task invisible to A ·
**A can't update B's task** · **A can't delete B's task** · fresh browser logs in and tasks persist — plus wrong-password
messages, duplicate emails, validation, mass-assignment (`user_id`, `completed_at`) and `completed_at` handling.
It creates throw-away users named `horizon-test-…@example.com`; delete them whenever you like.

### Manual check in the browser

1. Register `a@test.com` → add a task "Only for A".
2. Log out → register `b@test.com` → "Only for A" must not be there.
3. Close the browser completely, reopen, log in → your tasks are still there.
4. Open DevTools → Application → Local Storage: you should see only theme/collapsed keys — no tasks, no tokens.
   Cookies: `horizon.sid` is marked **HttpOnly**.

---

## Deployment notes

- Set `NODE_ENV=production`. This turns on `Secure` cookies, so **you must serve the site over HTTPS** (all common hosts do this for you) — otherwise login will appear to succeed but the browser will drop the cookie.
- Behind a proxy/load balancer (Render, Railway, Heroku, Fly, Nginx…) the app already uses `trust proxy = 1`, so rate limiting sees real client IPs. If you have more than one proxy layer, adjust that number in `server/server.js`.
- Use a **managed PostgreSQL** and put its URL in `DATABASE_URL`; set `DATABASE_SSL=true` if the provider requires SSL.
- Generate a unique `SESSION_SECRET` (≥ 32 characters) for production; changing it logs everybody out.
- Run `npm run db:init` once on the production database (it's idempotent). For future schema changes, add numbered migration files rather than editing `schema.sql` in place.
- The rate limiter keeps its counters in memory, which is fine for one server process. With several instances, move it to a shared store (e.g. Redis).
- Back up the database. Tasks live nowhere else.

## Known limitations (good next steps)

- No email verification or "forgot password" flow.
- Registration reveals whether an email is already used (the brief asks for a `409`). Sign-up is rate limited to slow down probing.
- No "log out of all devices" button (sessions are in the `session` table, so it would be easy to add).
- Inline `style=""` attributes (used for category colours) require `style-src 'unsafe-inline'` in the CSP. Scripts are fully locked down.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `DATABASE_URL is not set` / `SESSION_SECRET is not set` | You haven't created `.env` yet (step 4) |
| `Could not connect to PostgreSQL` | Is PostgreSQL running? Check host, port, user, password in `DATABASE_URL` |
| `password authentication failed` | Wrong user/password in `DATABASE_URL`; special characters must be URL-encoded |
| `Database tables are missing` | Run `npm run db:init` |
| `npm install` fails building `bcrypt` | Use Node 18/20/22 LTS, or run `npm install bcrypt@latest`. Last resort: `npm uninstall bcrypt && npm install bcryptjs` and change `require('bcrypt')` to `require('bcryptjs')` in `server/routes/auth.js` (same API, pure JavaScript) |
| Logged in, but refresh logs you out (production) | Site isn't served over HTTPS, or the proxy isn't forwarding `X-Forwarded-Proto` |
| `429 Too many login attempts` | Wait 15 minutes (or restart the server in development) |

---

## What changed in the original frontend

Your design, features and structure are untouched. The changes were limited to connecting it to the backend:

- **`index.html`** — added the account area in the navbar, the login/register screen, and loading/error screens. The footer text now says tasks are stored in your account. `#main` starts hidden until the session check finishes.
- **`style.css`** — appended a new section 17 (auth card, account area, spinner, disabled buttons). Two small edits to existing rules: email/password inputs were added to the shared input selector, and a global `[hidden] { display: none !important; }` rule was added (see below).
- **`script.js`** — `localStorage` task persistence (`loadTasksFromStorage`, `saveTasks`, `loadOrSeedTasks`, `createSeedTasks`, `STORAGE_KEY`) and the ID/date helpers that only existed for seeding were removed. Added an `apiRequest()` helper and a new section 14 (auth + views). `handleToggleComplete`, `moveTaskToCategory`, `performDelete` and `handleComposerSubmit` now call the API and only change the screen after the server confirms. All rendering, filtering, sorting, drag & drop, theme and collapse code is unchanged.

**One existing bug fixed along the way:** elements such as `.global-empty`, `.no-results` and `#clearFilters` set their own `display`, which overrides the HTML `hidden` attribute, so they were always visible. The `[hidden]` rule makes `hidden` work everywhere, as the original JavaScript intended.
