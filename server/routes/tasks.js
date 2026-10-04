/* ==========================================================================
   server/routes/tasks.js — the task REST API.
   Mounted at /api/tasks and protected by requireAuth (see server.js), so every
   handler below can rely on req.session.userId being set.

   SECURITY RULE USED EVERYWHERE IN THIS FILE
   -------------------------------------------
   The owner of a task is always taken from the session (req.session.userId),
   NEVER from the request. Every query that touches an existing task has
   "AND user_id = $n", so changing a task id in the browser can only ever
   reach your own tasks. If a task exists but belongs to someone else, we answer
   404 — exactly the same as for an id that doesn't exist — so nothing leaks.
   ========================================================================== */
const express = require('express');

const { query } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { toClientTask } = require('../utils/serialize');
const { ValidationError, isUuid, validateTaskInput } = require('../utils/validate');

const router = express.Router();

const TASK_COLUMNS =
  'id, title, description, due_date, priority, category, completed, created_at, completed_at';

// Maps API field names to column names. Because only these keys can ever be used
// to build the UPDATE statement, user input never becomes part of the SQL text.
const UPDATABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  dueDate: 'due_date',
  priority: 'priority',
  category: 'category',
};

const notFound = (res) => res.status(404).json({ error: 'Task not found.' });

/* ---------- GET /api/tasks ---------- */
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = $1 ORDER BY created_at ASC, id ASC`,
    [req.session.userId]
  );
  res.json({ tasks: rows.map(toClientTask) });
}));

/* ---------- POST /api/tasks ---------- */
router.post('/', asyncHandler(async (req, res) => {
  const t = validateTaskInput(req.body, { partial: false });

  const { rows } = await query(
    `INSERT INTO tasks (user_id, title, description, due_date, priority, category)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${TASK_COLUMNS}`,
    [req.session.userId, t.title, t.description, t.dueDate, t.priority, t.category]
  );
  res.status(201).json({ task: toClientTask(rows[0]) });
}));

/* ---------- PUT /api/tasks/:id ---------- */
router.put('/:id', asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) return notFound(res); // avoids a Postgres "invalid uuid" error

  const fields = validateTaskInput(req.body, { partial: true });
  const keys = Object.keys(fields);
  if (keys.length === 0) throw new ValidationError('No valid fields to update.');

  const sets = [];
  const values = [];
  for (const key of keys) {
    values.push(fields[key]);
    const placeholder = `$${values.length}`;
    if (key === 'completed') {
      // The server — not the client — controls completed_at.
      // Completing sets it to now (keeping the original time if it was already
      // completed); un-completing clears it.
      sets.push(`completed = ${placeholder}::boolean`);
      sets.push(`completed_at = CASE WHEN ${placeholder}::boolean THEN COALESCE(completed_at, NOW()) ELSE NULL END`);
    } else {
      sets.push(`${UPDATABLE_COLUMNS[key]} = ${placeholder}`);
    }
  }
  sets.push('updated_at = NOW()');

  values.push(req.params.id, req.session.userId);
  const idPos = values.length - 1;
  const userPos = values.length;

  const { rows } = await query(
    `UPDATE tasks SET ${sets.join(', ')}
     WHERE id = $${idPos} AND user_id = $${userPos}
     RETURNING ${TASK_COLUMNS}`,
    values
  );
  if (rows.length === 0) return notFound(res);
  res.json({ task: toClientTask(rows[0]) });
}));

/* ---------- DELETE /api/tasks/:id ---------- */
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) return notFound(res);

  const { rowCount } = await query(
    'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
    [req.params.id, req.session.userId]
  );
  if (rowCount === 0) return notFound(res);
  res.json({ deleted: true, id: req.params.id });
}));

module.exports = router;
