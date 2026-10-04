/* ==========================================================================
   server/utils/validate.js — all input validation lives here.
   This file has no dependencies, so it is easy to unit test (npm test).
   Never trust the frontend: every route runs its input through these checks.
   ========================================================================== */

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = [
  'today', 'tomorrow', 'thisWeek', 'nextWeek',
  'thisMonth', 'nextMonth', 'thisYear', 'longTerm',
];

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 500;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt silently ignores anything after 72 bytes

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Thrown for bad input. The error handler in server.js turns it into HTTP 400.
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/* ---------- auth ---------- */

function validateEmail(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError('Email is required.');
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new ValidationError('Please enter a valid email address.');
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value === '') {
    throw new ValidationError('Password is required.');
  }
  if (value.length < PASSWORD_MIN) {
    throw new ValidationError(`Password must be at least ${PASSWORD_MIN} characters.`);
  }
  if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new ValidationError('Password is too long (72 characters maximum).');
  }
  return value;
}

/* ---------- tasks ---------- */

function validateTitle(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError('Title is required.');
  }
  const title = value.trim();
  if (title.length > TITLE_MAX) {
    throw new ValidationError(`Title must be ${TITLE_MAX} characters or fewer.`);
  }
  return title;
}

// Returns a trimmed string, or null when empty (stored as NULL in the database).
function validateDescription(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new ValidationError('Description must be text.');
  }
  const description = value.trim();
  if (description.length > DESCRIPTION_MAX) {
    throw new ValidationError(`Description must be ${DESCRIPTION_MAX} characters or fewer.`);
  }
  return description === '' ? null : description;
}

// Accepts null / "" (no due date) or a real calendar date as "YYYY-MM-DD".
function validateDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new ValidationError('Due date must be a valid date (YYYY-MM-DD).');
  }
  const [y, m, d] = value.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  const isRealDate =
    check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
  if (!isRealDate) {
    throw new ValidationError('Due date must be a valid date (YYYY-MM-DD).');
  }
  return value;
}

function validatePriority(value) {
  if (!PRIORITIES.includes(value)) {
    throw new ValidationError(`Priority must be one of: ${PRIORITIES.join(', ')}.`);
  }
  return value;
}

function validateCategory(value) {
  if (!CATEGORIES.includes(value)) {
    throw new ValidationError(`Category must be one of: ${CATEGORIES.join(', ')}.`);
  }
  return value;
}

function validateCompleted(value) {
  if (typeof value !== 'boolean') {
    throw new ValidationError('Completed must be true or false.');
  }
  return value;
}

/**
 * Validate a task request body.
 *
 *  - partial = false (POST):  title and category are required; priority defaults to "medium".
 *  - partial = true  (PUT):   only the fields that were sent are validated and returned.
 *
 * Only whitelisted fields are ever returned. Anything else in the body — including
 * a `user_id`, `id` or `completed_at` — is silently ignored.
 */
function validateTaskInput(body, { partial }) {
  const input = body && typeof body === 'object' ? body : {};
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);
  const out = {};

  if (has('title') || !partial) out.title = validateTitle(input.title);
  if (has('description')) out.description = validateDescription(input.description);
  else if (!partial) out.description = null;
  if (has('dueDate')) out.dueDate = validateDueDate(input.dueDate);
  else if (!partial) out.dueDate = null;
  if (has('priority')) out.priority = validatePriority(input.priority);
  else if (!partial) out.priority = 'medium';
  if (has('category') || !partial) out.category = validateCategory(input.category);
  if (partial && has('completed')) out.completed = validateCompleted(input.completed);

  return out;
}

module.exports = {
  PRIORITIES,
  CATEGORIES,
  ValidationError,
  isUuid,
  validateEmail,
  validatePassword,
  validateTaskInput,
};
