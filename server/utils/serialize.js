// Convert a database row (snake_case) into the object shape the Horizon frontend
// already uses: { id, title, description, dueDate, priority, category,
//                 completed, createdDate, completedDate }.
// user_id is deliberately NOT included.
const toIso = (value) => (value instanceof Date ? value.toISOString() : value || null);

function toClientTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    dueDate: row.due_date || null, // "YYYY-MM-DD" string (see types.setTypeParser in db.js)
    priority: row.priority,
    category: row.category,
    completed: row.completed,
    createdDate: toIso(row.created_at),
    completedDate: toIso(row.completed_at),
  };
}

function toPublicUser(row) {
  return { id: row.id, email: row.email }; // never password_hash
}

module.exports = { toClientTask, toPublicUser };
