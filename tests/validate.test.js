/* Unit tests for server/utils/validate.js — no database or server needed.
   Run with:  npm test                                                        */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ValidationError, isUuid, validateEmail, validatePassword, validateTaskInput,
} = require('../server/utils/validate');

const throwsValidation = (fn, pattern) =>
  assert.throws(fn, (err) => err instanceof ValidationError && err.status === 400 && (!pattern || pattern.test(err.message)));

test('email: trimmed, lowercased, and format-checked', () => {
  assert.equal(validateEmail('  User@Example.COM '), 'user@example.com');
  throwsValidation(() => validateEmail(''), /required/i);
  throwsValidation(() => validateEmail(undefined), /required/i);
  throwsValidation(() => validateEmail('not-an-email'), /valid email/i);
  throwsValidation(() => validateEmail('a b@c.com'), /valid email/i);
  throwsValidation(() => validateEmail(`${'a'.repeat(250)}@x.com`), /valid email/i);
});

test('password: minimum length and bcrypt 72-byte ceiling', () => {
  assert.equal(validatePassword('12345678'), '12345678');
  throwsValidation(() => validatePassword('short'), /at least 8/i);
  throwsValidation(() => validatePassword(''), /required/i);
  throwsValidation(() => validatePassword(12345678), /required/i);
  throwsValidation(() => validatePassword('a'.repeat(73)), /too long/i);
  assert.equal(validatePassword('a'.repeat(72)).length, 72);
  // 40 emoji = 160 bytes: short in characters, over the limit in bytes
  throwsValidation(() => validatePassword('😀'.repeat(40)), /too long/i);
});

test('uuid check', () => {
  assert.equal(isUuid('3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b'), true);
  assert.equal(isUuid('123'), false);
  assert.equal(isUuid("1' OR '1'='1"), false);
  assert.equal(isUuid(undefined), false);
});

test('task create: title + category required, sensible defaults', () => {
  const t = validateTaskInput({ title: '  Write tests ', category: 'today' }, { partial: false });
  assert.deepEqual(t, { title: 'Write tests', description: null, dueDate: null, priority: 'medium', category: 'today' });
  throwsValidation(() => validateTaskInput({ category: 'today' }, { partial: false }), /title/i);
  throwsValidation(() => validateTaskInput({ title: 'x' }, { partial: false }), /category/i);
  throwsValidation(() => validateTaskInput({ title: '   ', category: 'today' }, { partial: false }), /title/i);
  throwsValidation(() => validateTaskInput(undefined, { partial: false }), /title/i);
});

test('task limits: title 120, description 500', () => {
  assert.doesNotThrow(() => validateTaskInput({ title: 'a'.repeat(120), category: 'today' }, { partial: false }));
  throwsValidation(() => validateTaskInput({ title: 'a'.repeat(121), category: 'today' }, { partial: false }), /120/);
  assert.doesNotThrow(() => validateTaskInput({ title: 'x', category: 'today', description: 'a'.repeat(500) }, { partial: false }));
  throwsValidation(() => validateTaskInput({ title: 'x', category: 'today', description: 'a'.repeat(501) }, { partial: false }), /500/);
  assert.equal(validateTaskInput({ title: 'x', category: 'today', description: '   ' }, { partial: false }).description, null);
});

test('task enums: every valid priority/category passes, anything else fails', () => {
  for (const priority of ['low', 'medium', 'high', 'critical']) {
    assert.equal(validateTaskInput({ priority }, { partial: true }).priority, priority);
  }
  for (const category of ['today', 'tomorrow', 'thisWeek', 'nextWeek', 'thisMonth', 'nextMonth', 'thisYear', 'longTerm']) {
    assert.equal(validateTaskInput({ category }, { partial: true }).category, category);
  }
  throwsValidation(() => validateTaskInput({ priority: 'urgent' }, { partial: true }), /priority/i);
  throwsValidation(() => validateTaskInput({ category: 'someday' }, { partial: true }), /category/i);
  throwsValidation(() => validateTaskInput({ category: 'TODAY' }, { partial: true }), /category/i);
});

test('due date: real calendar dates only', () => {
  assert.equal(validateTaskInput({ dueDate: '2026-10-05' }, { partial: true }).dueDate, '2026-10-05');
  assert.equal(validateTaskInput({ dueDate: '' }, { partial: true }).dueDate, null);
  assert.equal(validateTaskInput({ dueDate: null }, { partial: true }).dueDate, null);
  assert.equal(validateTaskInput({ dueDate: '2028-02-29' }, { partial: true }).dueDate, '2028-02-29'); // leap day
  throwsValidation(() => validateTaskInput({ dueDate: '2027-02-29' }, { partial: true }), /date/i);
  throwsValidation(() => validateTaskInput({ dueDate: '2026-13-01' }, { partial: true }), /date/i);
  throwsValidation(() => validateTaskInput({ dueDate: '10/05/2026' }, { partial: true }), /date/i);
  throwsValidation(() => validateTaskInput({ dueDate: 20261005 }, { partial: true }), /date/i);
});

test('task update (partial): only sent fields are returned; completed must be a boolean', () => {
  assert.deepEqual(validateTaskInput({ completed: true }, { partial: true }), { completed: true });
  assert.deepEqual(validateTaskInput({ category: 'nextWeek' }, { partial: true }), { category: 'nextWeek' });
  assert.deepEqual(validateTaskInput({}, { partial: true }), {});
  throwsValidation(() => validateTaskInput({ completed: 'true' }, { partial: true }), /completed/i);
  throwsValidation(() => validateTaskInput({ completed: 1 }, { partial: true }), /completed/i);
});

test('mass-assignment: user_id, id, completed_at and unknown fields are ignored', () => {
  const create = validateTaskInput(
    { title: 'x', category: 'today', user_id: 'someone-else', userId: 'someone-else', id: 'abc', completed_at: '2020-01-01', completed: true, isAdmin: true },
    { partial: false }
  );
  assert.deepEqual(Object.keys(create).sort(), ['category', 'description', 'dueDate', 'priority', 'title']);

  const update = validateTaskInput({ user_id: 'someone-else', id: 'abc', completed_at: '2020-01-01', title: 'new' }, { partial: true });
  assert.deepEqual(update, { title: 'new' });
});
