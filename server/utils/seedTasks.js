/* ==========================================================================
   server/utils/seedTasks.js — example tasks given to a brand-new account.

   They are inserted ONCE, inside the same transaction that creates the user
   (see routes/auth.js). Logging in never creates them again.

   Dates are offsets from "now" so the examples always look current:
     dueInDays     -> due date = today + N days (null = no due date)
     createdDaysAgo -> created_at = now - N days
   ========================================================================== */
const SEED_TASKS = [
  { title: 'Finish quarterly report', description: 'Pull the numbers from finance and write the summary.', dueInDays: 0, priority: 'critical', category: 'today', completed: false, createdDaysAgo: 2 },
  { title: 'Go to the gym', description: '', dueInDays: 0, priority: 'medium', category: 'today', completed: true, createdDaysAgo: 1 },
  { title: 'Prep slides for client call', description: 'Focus on the roadmap section.', dueInDays: 1, priority: 'high', category: 'tomorrow', completed: false, createdDaysAgo: 3 },
  { title: 'Learn JavaScript closures', description: 'Work through two chapters and take notes.', dueInDays: 4, priority: 'medium', category: 'thisWeek', completed: false, createdDaysAgo: 4 },
  { title: 'Submit assignment', description: '', dueInDays: 3, priority: 'high', category: 'thisWeek', completed: false, createdDaysAgo: 2 },
  { title: 'Renew passport', description: 'Book an appointment at the consulate.', dueInDays: 20, priority: 'low', category: 'thisMonth', completed: false, createdDaysAgo: 6 },
  { title: 'Become a cybersecurity engineer', description: 'Finish the certification path, then land the first role.', dueInDays: null, priority: 'high', category: 'longTerm', completed: false, createdDaysAgo: 30 },
  { title: 'Start a company', description: 'Validate an idea, then build a small first version.', dueInDays: null, priority: 'medium', category: 'longTerm', completed: false, createdDaysAgo: 30 },
];

// `CURRENT_DATE + NULL` is NULL, so tasks with no due date need no special case.
const INSERT_SEED_SQL = `
  INSERT INTO tasks
    (user_id, title, description, due_date, priority, category, completed, created_at, completed_at)
  VALUES
    ($1, $2, $3, CURRENT_DATE + $4::int, $5, $6, $7::boolean,
     NOW() - make_interval(days => $8::int),
     CASE WHEN $7::boolean THEN NOW() ELSE NULL END)`;

// Insert the examples for one user using an open transaction client.
async function insertSeedTasks(client, userId) {
  for (const t of SEED_TASKS) {
    await client.query(INSERT_SEED_SQL, [
      userId, t.title, t.description || null, t.dueInDays, t.priority,
      t.category, t.completed, t.createdDaysAgo,
    ]);
  }
}

module.exports = { SEED_TASKS, insertSeedTasks };
