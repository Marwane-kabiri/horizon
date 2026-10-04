/* ==========================================================================
   tests/api-security.test.js — end-to-end checks against a RUNNING server.

   1. Start PostgreSQL and the app:        npm start
   2. In another terminal:                  npm run test:api
      (different address?  BASE_URL=http://localhost:4000 npm run test:api)

   It creates two throw-away users and walks through the six scenarios from the
   project brief (user isolation, IDOR attempts, persistence), plus a few extra
   security checks. Test users are left in the database — delete them if you like.
   Requires Node 18+ (built-in fetch).
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const RUN = Date.now().toString(36);
const PASSWORD = 'correct-horse-battery';

// A tiny HTTP client with its own cookie jar — it plays the role of "one browser".
class Browser {
  constructor() { this.jar = new Map(); this.lastSetCookies = []; }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');

    const res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    this.lastSetCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const cookie of this.lastSetCookies) {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      if (value === '' || /max-age=0/i.test(cookie) || /expires=thu, 01 jan 1970/i.test(cookie)) this.jar.delete(name);
      else this.jar.set(name, value);
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, raw: res };
  }

  register(email, password = PASSWORD) {
    return this.request('POST', '/api/auth/register', { email, password, confirmPassword: password });
  }
  login(email, password = PASSWORD) { return this.request('POST', '/api/auth/login', { email, password }); }
  logout() { return this.request('POST', '/api/auth/logout'); }
  tasks() { return this.request('GET', '/api/tasks'); }
}

const emailA = `horizon-test-${RUN}-a@example.com`;
const emailB = `horizon-test-${RUN}-b@example.com`;
let taskA; // created by user A
let taskB; // created by user B

const titles = (res) => res.data.tasks.map((t) => t.title);

test('Test 1 — register User A, create Task A, and see it', async () => {
  const a = new Browser();
  const reg = await a.register(emailA);
  assert.equal(reg.status, 201);
  assert.equal(reg.data.user.email, emailA);
  assert.equal(reg.data.user.password, undefined, 'password must never be returned');
  assert.equal(reg.data.user.password_hash, undefined, 'hash must never be returned');
  assert.ok(a.lastSetCookies.some((c) => /httponly/i.test(c)), 'session cookie must be HttpOnly');

  const created = await a.request('POST', '/api/tasks', { title: 'Task A', category: 'today', priority: 'high', dueDate: '2030-01-31' });
  assert.equal(created.status, 201);
  taskA = created.data.task;
  assert.equal(taskA.completed, false);
  assert.equal(taskA.dueDate, '2030-01-31');
  assert.equal(taskA.user_id, undefined, 'user_id must not be exposed');

  const list = await a.tasks();
  assert.equal(list.status, 200);
  assert.ok(titles(list).includes('Task A'));
  assert.equal(list.data.tasks.length, 9, 'new accounts get 8 example tasks + Task A');
});

test('Test 2 — logout, then User B must NOT see Task A', async () => {
  const a = new Browser();
  assert.equal((await a.login(emailA)).status, 200);
  assert.equal((await a.logout()).status, 200);
  assert.equal((await a.tasks()).status, 401, 'after logout the old session must be dead');

  const b = new Browser();
  assert.equal((await b.register(emailB)).status, 201);
  const list = await b.tasks();
  assert.equal(list.status, 200);
  assert.ok(!titles(list).includes('Task A'), "User B can see User A's task!");
  assert.equal(list.data.tasks.length, 8, 'B starts with just the 8 example tasks');
});

test('Test 3 — B creates Task B; A then sees only A\'s tasks', async () => {
  const b = new Browser();
  assert.equal((await b.login(emailB)).status, 200);
  const created = await b.request('POST', '/api/tasks', { title: 'Task B', category: 'tomorrow' });
  assert.equal(created.status, 201);
  taskB = created.data.task;
  await b.logout();

  const a = new Browser();
  assert.equal((await a.login(emailA)).status, 200);
  const list = await a.tasks();
  assert.ok(titles(list).includes('Task A'));
  assert.ok(!titles(list).includes('Task B'), "User A can see User B's task!");
});

test("Test 4 — A cannot UPDATE B's task (IDOR)", async () => {
  const a = new Browser();
  await a.login(emailA);

  for (const body of [{ title: 'HACKED' }, { completed: true }, { category: 'longTerm' }]) {
    const res = await a.request('PUT', `/api/tasks/${taskB.id}`, body);
    assert.equal(res.status, 404, `expected 404, got ${res.status} for ${JSON.stringify(body)}`);
  }

  // Prove nothing changed, from B's side.
  const b = new Browser();
  await b.login(emailB);
  const stillThere = (await b.tasks()).data.tasks.find((t) => t.id === taskB.id);
  assert.equal(stillThere.title, 'Task B');
  assert.equal(stillThere.completed, false);
  assert.equal(stillThere.category, 'tomorrow');
});

test("Test 5 — A cannot DELETE B's task (IDOR)", async () => {
  const a = new Browser();
  await a.login(emailA);
  const res = await a.request('DELETE', `/api/tasks/${taskB.id}`);
  assert.equal(res.status, 404);

  const b = new Browser();
  await b.login(emailB);
  assert.ok((await b.tasks()).data.tasks.some((t) => t.id === taskB.id), "B's task was deleted by A!");
});

test('Test 6 — a brand-new browser can log in and still has its tasks', async () => {
  const freshBrowser = new Browser(); // no cookies = "closed and re-opened the browser"
  assert.equal((await freshBrowser.tasks()).status, 401);
  assert.equal((await freshBrowser.login(emailA)).status, 200);
  assert.ok(titles(await freshBrowser.tasks()).includes('Task A'));
});

/* ---------------- extra checks ---------------- */

test('extra — /api/auth/me reports authentication state', async () => {
  const anon = new Browser();
  const none = await anon.request('GET', '/api/auth/me');
  assert.equal(none.status, 200);
  assert.deepEqual(none.data, { authenticated: false });

  await anon.login(emailA);
  const me = await anon.request('GET', '/api/auth/me');
  assert.equal(me.data.authenticated, true);
  assert.equal(me.data.user.email, emailA);
});

test('extra — wrong password and unknown email give the same 401 message', async () => {
  const x = new Browser();
  const wrongPassword = await x.login(emailA, 'definitely-wrong-password');
  const unknownEmail = await x.login(`nobody-${RUN}@example.com`, 'definitely-wrong-password');
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.data.error, unknownEmail.data.error);
});

test('extra — duplicate email is rejected with 409 (case-insensitive)', async () => {
  const x = new Browser();
  const res = await x.register(emailA.toUpperCase());
  assert.equal(res.status, 409);
});

test('extra — registration validation (email, short password, mismatch)', async () => {
  const x = new Browser();
  assert.equal((await x.request('POST', '/api/auth/register', { email: 'nope', password: PASSWORD })).status, 400);
  assert.equal((await x.request('POST', '/api/auth/register', { email: `v-${RUN}@example.com`, password: 'short' })).status, 400);
  assert.equal((await x.request('POST', '/api/auth/register', { email: `v-${RUN}@example.com`, password: PASSWORD, confirmPassword: 'different-one' })).status, 400);
});

test('extra — task endpoints require login', async () => {
  const anon = new Browser();
  assert.equal((await anon.request('GET', '/api/tasks')).status, 401);
  assert.equal((await anon.request('POST', '/api/tasks', { title: 'x', category: 'today' })).status, 401);
  assert.equal((await anon.request('PUT', `/api/tasks/${taskA.id}`, { title: 'x' })).status, 401);
  assert.equal((await anon.request('DELETE', `/api/tasks/${taskA.id}`)).status, 401);
});

test('extra — client-supplied user_id / completed_at are ignored; completed_at is server-controlled', async () => {
  const a = new Browser();
  await a.login(emailA);

  const created = await a.request('POST', '/api/tasks', {
    title: 'Mass assignment', category: 'today',
    user_id: '00000000-0000-0000-0000-000000000000', completed_at: '2001-01-01T00:00:00Z',
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.task.completedDate, null);
  const id = created.data.task.id;

  const done = await a.request('PUT', `/api/tasks/${id}`, { completed: true, completed_at: '2001-01-01T00:00:00Z' });
  assert.equal(done.status, 200);
  assert.equal(done.data.task.completed, true);
  assert.ok(new Date(done.data.task.completedDate).getFullYear() >= 2024, 'completed_at must be set by the server');

  const undone = await a.request('PUT', `/api/tasks/${id}`, { completed: false });
  assert.equal(undone.data.task.completed, false);
  assert.equal(undone.data.task.completedDate, null);

  assert.equal((await a.request('DELETE', `/api/tasks/${id}`)).status, 200);
  assert.equal((await a.request('DELETE', `/api/tasks/${id}`)).status, 404, 'second delete: already gone');
});

test('extra — invalid task input is rejected with 400; odd ids with 404', async () => {
  const a = new Browser();
  await a.login(emailA);
  const bad = [
    { category: 'today' },                                    // no title
    { title: 'x' },                                           // no category
    { title: 'x'.repeat(121), category: 'today' },            // title too long
    { title: 'x', category: 'today', description: 'y'.repeat(501) },
    { title: 'x', category: 'someday' },                      // bad category
    { title: 'x', category: 'today', priority: 'urgent' },    // bad priority
    { title: 'x', category: 'today', dueDate: '2026-02-31' }, // impossible date
  ];
  for (const body of bad) {
    const res = await a.request('POST', '/api/tasks', body);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body).slice(0, 60)}`);
  }
  assert.equal((await a.request('PUT', `/api/tasks/${taskA.id}`, {})).status, 400, 'empty update');
  assert.equal((await a.request('PUT', '/api/tasks/not-a-uuid', { title: 'x' })).status, 404);
  assert.equal((await a.request('DELETE', "/api/tasks/1' OR '1'='1")).status, 404);
});
