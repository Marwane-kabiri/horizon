/* ==========================================================================
   HORIZON — task manager organized by time horizon
   Table of contents:
   1. Constants & icon library
   2. Category definitions
   3. App state
   4. API client & UI-preference storage
   5. Utilities (dates, ids, formatting)
   6. Rendering — stats, horizon rail, board, task cards
   7. Task actions — add/edit/toggle/move/delete
   8. Composer (form) controls
   9. Filters, search & sort
   10. Confirm dialog
   11. Toast notifications
   12. Theme
   13. Event binding & init
   14. Auth, views & session
   ========================================================================== */

/* ==========================================================================
   1. CONSTANTS & ICON LIBRARY
   Small hand-drawn SVGs (no icon library / no network dependency).
   ========================================================================== */
const API_BASE       = "/api"; // tasks + accounts live on the server (PostgreSQL), not in this browser
const THEME_KEY      = "horizon_todo_theme_v1";
const COLLAPSED_KEY  = "horizon_todo_collapsed_v1";

const ICONS = {
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="4,12 9,17 20,6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M14.5 5.5l4 4L8 20H4v-4L14.5 5.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 7V4.5h6V7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="6" y="7" width="12" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  calendar: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.7"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5" stroke="currentColor" stroke-width="1.7"/><line x1="8" y1="2.5" x2="8" y2="6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><line x1="16" y1="2.5" x2="16" y2="6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3.2 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  dragHandle: `<svg width="14" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/></svg>`,

  catToday: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.3" stroke="currentColor" stroke-width="1.7"/><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="4.8" y1="4.8" x2="6.5" y2="6.5"/><line x1="17.5" y1="17.5" x2="19.2" y2="19.2"/><line x1="4.8" y1="19.2" x2="6.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="19.2" y2="4.8"/></g></svg>`,
  catTomorrow: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><line x1="2" y1="18.5" x2="22" y2="18.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M6.5 14.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><polyline points="9,7.5 12,4.5 15,7.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="12" y1="4.5" x2="12" y2="10.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  catThisWeek: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3.2" y="4.5" width="17.6" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><line x1="3.2" y1="9.3" x2="20.8" y2="9.3" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="2.3" x2="8" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="16" y1="2.3" x2="16" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="7.5" y1="17" x2="7.5" y2="13"/><line x1="12" y1="17" x2="12" y2="12"/><line x1="16.5" y1="17" x2="16.5" y2="14.5"/></g></svg>`,
  catNextWeek: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3.2" y="4.5" width="17.6" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><line x1="3.2" y1="9.3" x2="20.8" y2="9.3" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="2.3" x2="8" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="16" y1="2.3" x2="16" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="7.5" y1="17" x2="7.5" y2="13"/><line x1="11.5" y1="17" x2="11.5" y2="12"/></g><line x1="14" y1="15.3" x2="16.6" y2="15.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><polyline points="15.3,13.3 17.6,15.3 15.3,17.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  catThisMonth: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3.2" y="4.5" width="17.6" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><line x1="3.2" y1="9.3" x2="20.8" y2="9.3" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="2.3" x2="8" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="16" y1="2.3" x2="16" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g fill="currentColor"><circle cx="7.8" cy="13" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="16.2" cy="13" r="1"/><circle cx="7.8" cy="17" r="1"/><circle cx="12" cy="17" r="1"/><circle cx="16.2" cy="17" r="1"/></g></svg>`,
  catNextMonth: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3.2" y="4.5" width="17.6" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><line x1="3.2" y1="9.3" x2="20.8" y2="9.3" stroke="currentColor" stroke-width="1.6"/><line x1="8" y1="2.3" x2="8" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="16" y1="2.3" x2="16" y2="6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g fill="currentColor"><circle cx="7.8" cy="13" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="16.2" cy="13" r="1"/><circle cx="7.8" cy="17" r="1"/></g><polyline points="11,15.7 13.2,17.3 11,18.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  catThisYear: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="8.2" ry="3.4" stroke="currentColor" stroke-width="1.6"/><line x1="3.8" y1="12" x2="20.2" y2="12" stroke="currentColor" stroke-width="1.6"/></svg>`,
  catLongTerm: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><polyline points="2.5,19.5 8.5,9.5 12.5,15 15.5,10.5 21.5,19.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" fill="none"/><line x1="15.5" y1="10.5" x2="15.5" y2="3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M15.5 3.5l4.2 1.6-4.2 1.6Z" fill="currentColor"/></svg>`,
};

/* ==========================================================================
   2. CATEGORY DEFINITIONS
   Colors move warm → cool across the timeline, so hue itself communicates
   urgency: red-orange today, fading to violet for long-term goals.
   ========================================================================== */
const CATEGORIES = [
  { key: "today",     label: "Today",            color: "#f97362", icon: ICONS.catToday },
  { key: "tomorrow",  label: "Tomorrow",         color: "#fb923c", icon: ICONS.catTomorrow },
  { key: "thisWeek",  label: "This week",        color: "#fbbf24", icon: ICONS.catThisWeek },
  { key: "nextWeek",  label: "Next week",        color: "#a3e635", icon: ICONS.catNextWeek },
  { key: "thisMonth", label: "This month",       color: "#34d399", icon: ICONS.catThisMonth },
  { key: "nextMonth", label: "Next month",       color: "#22d3ee", icon: ICONS.catNextMonth },
  { key: "thisYear",  label: "This year",        color: "#60a5fa", icon: ICONS.catThisYear },
  { key: "longTerm",  label: "Long-term goals",  color: "#a78bfa", icon: ICONS.catLongTerm, sublabel: "1–10 years" },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

/* ==========================================================================
   3. APP STATE
   ========================================================================== */
let tasks = [];
const state = {
  filters: { search: "", status: "all", priority: "all", sort: "dueAsc" },
  collapsed: new Set(),
  lastAddedId: null,
};
let pendingDeleteId = null;

// Account + request bookkeeping. None of this is saved in the browser.
const auth = { user: null, epoch: 0 }; // epoch changes on every login/logout, so a reply that
                                       // arrives after the person switched accounts is ignored
const pendingIds = new Set();          // ids of tasks that have a request in flight
let composerBusy = false;
let deleteBusy = false;
const GENERIC_ERROR = "Something went wrong. Please try again.";

/* ==========================================================================
   4. API CLIENT & UI-PREFERENCE STORAGE
   Tasks and accounts live on the server (PostgreSQL). The browser only keeps
   harmless UI preferences in localStorage: the theme and which sections are
   collapsed. No tasks, passwords or login tokens are stored here — the login
   session is an HTTP-only cookie that JavaScript cannot even read.
   ========================================================================== */
class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status; // HTTP status, or 0 when the server could not be reached
  }
}

// The single place every request goes through. It sends the session cookie,
// speaks JSON, and turns every failure into an ApiError with a message that is
// safe to show to the person.
async function apiRequest(url, options = {}) {
  const { body, headers, skipSessionExpired, ...rest } = options;

  let response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (networkError) {
    console.error("Horizon: network error", networkError);
    throw new ApiError(GENERIC_ERROR, 0);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // A 401 while we believe we are logged in means the session ended
    // (it expired, or the person logged out in another tab).
    if (response.status === 401 && auth.user && !skipSessionExpired) handleSessionExpired();
    throw new ApiError(data.error || GENERIC_ERROR, response.status);
  }
  return data;
}

function loadCollapsedFromStorage() {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsedState() {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...state.collapsed]));
  } catch (err) {
    console.error("Horizon: failed to save section state", err);
  }
}

/* ==========================================================================
   5. UTILITIES
   ========================================================================== */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Parse a plain "YYYY-MM-DD" value as a LOCAL date (avoids UTC off-by-one).
function parseDateOnly(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateObj(d) {
  if (isNaN(d.getTime())) return "";
  const opts = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

function formatDueDate(dateOnlyStr) {
  return formatDateObj(parseDateOnly(dateOnlyStr));
}

function formatCreatedDate(isoStr) {
  return formatDateObj(new Date(isoStr));
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;
  const due = parseDateOnly(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isFiltering() {
  return state.filters.search !== "" || state.filters.status !== "all" || state.filters.priority !== "all";
}

/* ==========================================================================
   6. RENDERING
   ========================================================================== */
function renderApp() {
  renderStats();
  renderHorizonRail();
  renderBoard();
  updateClearFiltersVisibility();

  const hasAnyTasks = tasks.length > 0;
  $("#globalEmpty").hidden = hasAnyTasks;
  $(".horizon-rail-wrap").hidden = !hasAnyTasks;
  $(".toolbar").hidden = !hasAnyTasks;
  $("#board").hidden = !hasAnyTasks && true; // board also gated per-filter inside renderBoard()
  if (hasAnyTasks) $("#board").hidden = false;
}

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  // "High priority" surfaces open work that still needs attention.
  const highPriority = tasks.filter((t) => !t.completed && (t.priority === "high" || t.priority === "critical")).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  $("#statTotal").textContent = total;
  $("#statCompleted").textContent = completed;
  $("#statPending").textContent = pending;
  $("#statHighPriority").textContent = highPriority;
  $("#statPercent").textContent = pct + "%";

  const circumference = 2 * Math.PI * 27;
  const ring = $("#ringProgress");
  ring.style.strokeDasharray = String(circumference);
  ring.style.strokeDashoffset = String(circumference * (1 - pct / 100));
}

function renderHorizonRail() {
  const rail = $("#horizonRail");
  rail.innerHTML = CATEGORIES.map((cat) => {
    const count = tasks.filter((t) => t.category === cat.key).length;
    return `
      <button type="button" class="horizon-stop" data-jump="${cat.key}" style="--cat-color:${cat.color};--cat-color-soft:${cat.color}26;">
        <span class="horizon-stop-dot" aria-hidden="true"></span>
        <span>${cat.label}</span>
        <span class="horizon-stop-count">${count}</span>
      </button>`;
  }).join("");
}

function getFilteredSortedTasks(catKey) {
  let list = tasks.filter((t) => t.category === catKey);
  const { search, status, priority, sort } = state.filters;

  if (search) {
    list = list.filter(
      (t) => t.title.toLowerCase().includes(search) || (t.description || "").toLowerCase().includes(search)
    );
  }
  if (status === "active") list = list.filter((t) => !t.completed);
  if (status === "completed") list = list.filter((t) => t.completed);
  if (priority !== "all") list = list.filter((t) => t.priority === priority);

  return sortTasks(list, sort);
}

function sortTasks(list, sortKey) {
  const copy = [...list];
  switch (sortKey) {
    case "dueAsc":
      return copy.sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
    case "dueDesc":
      return copy.sort((a, b) => (b.dueDate || "0000-00-00").localeCompare(a.dueDate || "0000-00-00"));
    case "createdDesc":
      return copy.sort((a, b) => b.createdDate.localeCompare(a.createdDate));
    case "createdAsc":
      return copy.sort((a, b) => a.createdDate.localeCompare(b.createdDate));
    case "priority":
      return copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    default:
      return copy;
  }
}

function renderBoard() {
  const board = $("#board");
  const filtering = isFiltering();
  let anyCategoryShown = false;

  const html = CATEGORIES.map((cat) => {
    const all = tasks.filter((t) => t.category === cat.key);
    const visible = getFilteredSortedTasks(cat.key);
    if (filtering && visible.length === 0) return "";
    anyCategoryShown = true;

    const completed = all.filter((t) => t.completed).length;
    const total = all.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    const collapsed = state.collapsed.has(cat.key);

    const emptyMsg = filtering
      ? "No matches in this horizon."
      : "Nothing here yet — add a task above or drag one in.";

    const cardsHTML = visible.length
      ? visible.map(renderTaskCard).join("")
      : `<div class="horizon-empty">${emptyMsg}</div>`;

    return `
      <section class="horizon-section${collapsed ? " is-collapsed" : ""}" data-category="${cat.key}" style="--cat-color:${cat.color};--cat-color-soft:${cat.color}26;">
        <div class="horizon-header" data-action="toggle-collapse" role="button" tabindex="0" aria-expanded="${!collapsed}">
          <span class="horizon-icon" aria-hidden="true">${cat.icon}</span>
          <div class="horizon-title-wrap">
            <div class="horizon-title">
              <span>${cat.label}</span>
              ${cat.sublabel ? `<span class="horizon-sub">${cat.sublabel}</span>` : ""}
            </div>
            <span class="horizon-count">${completed}/${total} done</span>
          </div>
          <div class="horizon-progress-track">
            <div class="horizon-progress-fill" style="width:${pct}%"></div>
          </div>
          <svg class="horizon-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="horizon-body"><div class="horizon-body-inner">
          <div class="task-list" data-droplist="${cat.key}">${cardsHTML}</div>
        </div></div>
      </section>`;
  }).join("");

  board.innerHTML = html;
  $("#noResults").hidden = !(filtering && !anyCategoryShown && tasks.length > 0);

  if (state.lastAddedId) {
    const el = board.querySelector(`.task-card[data-id="${state.lastAddedId}"]`);
    if (el) el.classList.add("card-enter");
    state.lastAddedId = null;
  }
}

function renderTaskCard(t) {
  const overdue = isOverdue(t);
  const dueLabel = t.dueDate ? formatDueDate(t.dueDate) : null;

  return `
    <article class="task-card${t.completed ? " is-completed" : ""}${pendingIds.has(t.id) ? " is-pending" : ""}" data-id="${t.id}" draggable="true">
      <span class="drag-handle" aria-hidden="true" title="Drag to move">${ICONS.dragHandle}</span>
      <button class="check-btn" type="button" data-action="toggle" aria-pressed="${t.completed}" aria-label="${t.completed ? "Mark as pending" : "Mark as complete"}">${ICONS.check}</button>
      <div class="task-body">
        <div class="task-top">
          <h3 class="task-title">${escapeHTML(t.title)}</h3>
          <span class="priority-badge priority-${t.priority}"><span class="priority-dot" aria-hidden="true"></span>${capitalize(t.priority)}</span>
        </div>
        ${t.description ? `<p class="task-desc">${escapeHTML(t.description)}</p>` : ""}
        <div class="task-meta">
          ${dueLabel ? `<span class="meta-item${overdue ? " is-overdue" : ""}">${ICONS.calendar}${overdue ? "Overdue " : "Due "}${dueLabel}</span>` : ""}
          <span class="meta-item">${ICONS.clock}Added ${formatCreatedDate(t.createdDate)}</span>
        </div>
      </div>
      <div class="task-actions">
        <select class="move-select" data-action="move" aria-label="Move '${escapeHTML(t.title)}' to another time horizon">
          ${CATEGORIES.map((c) => `<option value="${c.key}"${c.key === t.category ? " selected" : ""}>${c.label}</option>`).join("")}
        </select>
        <button class="icon-btn edit-btn" type="button" data-action="edit" aria-label="Edit task">${ICONS.edit}</button>
        <button class="icon-btn delete-btn" type="button" data-action="delete" aria-label="Delete task">${ICONS.trash}</button>
      </div>
    </article>`;
}

function refreshSectionHeader(catKey) {
  const section = document.querySelector(`.horizon-section[data-category="${catKey}"]`);
  if (!section) return;
  const all = tasks.filter((t) => t.category === catKey);
  const completed = all.filter((t) => t.completed).length;
  const total = all.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const countEl = section.querySelector(".horizon-count");
  const fillEl = section.querySelector(".horizon-progress-fill");
  if (countEl) countEl.textContent = `${completed}/${total} done`;
  if (fillEl) fillEl.style.width = pct + "%";
}

/* ==========================================================================
   7. TASK ACTIONS
   Every action follows the same rule: ask the server first, and only change
   what is on screen after the server says it worked. If the request fails,
   the task stays exactly as it was and an error toast explains.
   ========================================================================== */
function replaceTask(updated) {
  const i = tasks.findIndex((x) => x.id === updated.id);
  if (i !== -1) tasks[i] = updated;
}

// Mark a task as "request in flight": dim its card and ignore clicks on it, so the
// same task can't be toggled or moved twice while the server is still answering.
function markPending(id, on) {
  if (on) pendingIds.add(id);
  else pendingIds.delete(id);
  const card = document.querySelector(`.task-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle("is-pending", on);
    card.setAttribute("aria-busy", String(on));
  }
}

function handleTaskError(err) {
  if (err.status === 401) return; // the session-expired flow has already taken over
  if (err.status === 404) {
    // e.g. the task was deleted from another device
    showToast("That task no longer exists. Refreshing your list…", "info");
    refreshTasksQuietly();
    return;
  }
  const friendly = err.status >= 400 && err.status < 500 && err.message ? err.message : GENERIC_ERROR;
  showToast(friendly, "danger");
}

async function handleToggleComplete(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t || pendingIds.has(id)) return;

  const epoch = auth.epoch;
  markPending(id, true);
  try {
    // The server decides completed_at; we wait for its answer before touching the UI.
    const { task: updated } = await apiRequest(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { completed: !t.completed },
    });
    if (epoch !== auth.epoch) return;
    replaceTask(updated);

    // Update the existing card in place first, so the check/strikethrough
    // transition actually has something to animate from.
    const card = document.querySelector(`.task-card[data-id="${id}"]`);
    if (card) {
      card.classList.toggle("is-completed", updated.completed);
      const btn = card.querySelector(".check-btn");
      if (btn) {
        btn.setAttribute("aria-pressed", String(updated.completed));
        btn.setAttribute("aria-label", updated.completed ? "Mark as pending" : "Mark as complete");
      }
    }

    renderStats();
    renderHorizonRail();
    refreshSectionHeader(updated.category);
    showToast(updated.completed ? "Nice — task completed" : "Marked as pending", "success");

    // If a status filter is active, the card may need to leave/enter the view —
    // reconcile the full board shortly after, once the toggle animation plays.
    if (state.filters.status !== "all") {
      window.setTimeout(renderBoard, 420);
    }
  } catch (err) {
    if (epoch === auth.epoch) handleTaskError(err);
  } finally {
    if (epoch === auth.epoch) markPending(id, false);
  }
}

async function moveTaskToCategory(id, newCategory) {
  const t = tasks.find((x) => x.id === id);
  if (!t || t.category === newCategory || !CATEGORY_MAP[newCategory]) return;
  if (pendingIds.has(id)) { renderBoard(); return; } // already saving; reset the dropdown

  const epoch = auth.epoch;
  markPending(id, true);
  try {
    const { task: updated } = await apiRequest(`${API_BASE}/tasks/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { category: newCategory },
    });
    if (epoch !== auth.epoch) return;
    replaceTask(updated);
    renderApp();
    showToast(`Moved “${updated.title}” to ${CATEGORY_MAP[updated.category].label}`, "info");
  } catch (err) {
    if (epoch !== auth.epoch) return;
    handleTaskError(err);
    renderBoard(); // put the "move to" dropdown back to the task's real horizon
  } finally {
    if (epoch === auth.epoch) markPending(id, false);
  }
}

function requestDeleteTask(id) {
  pendingDeleteId = id;
  const overlay = $("#confirmOverlay");
  const t = tasks.find((x) => x.id === id);
  $("#confirmMessage").textContent = t
    ? `“${t.title}” will be permanently removed from your list.`
    : "This can't be undone.";
  overlay.hidden = false;
  overlay.style.display = "grid";
  overlay.setAttribute("aria-hidden", "false");
  $("#confirmDelete").focus();
}

function setDeleteBusy(on) {
  deleteBusy = on;
  const confirmBtn = $("#confirmDelete");
  confirmBtn.disabled = on;
  confirmBtn.textContent = on ? "Deleting…" : "Delete task";
  $("#confirmCancel").disabled = on;
}

async function performDelete() {
  if (!pendingDeleteId || deleteBusy) return;
  const id = pendingDeleteId;
  const t = tasks.find((x) => x.id === id);
  const title = t ? t.title : "Task";
  const epoch = auth.epoch;

  setDeleteBusy(true);
  try {
    await apiRequest(`${API_BASE}/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    // Not deleted: the task stays where it is.
    if (epoch === auth.epoch) {
      setDeleteBusy(false);
      closeConfirmDelete();
      handleTaskError(err);
    }
    return;
  }
  if (epoch !== auth.epoch) return;

  setDeleteBusy(false);
  closeConfirmDelete();

  // The server confirmed the delete — now remove it from the screen,
  // with the same exit animation as before.
  const finish = (() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      if (epoch !== auth.epoch) return;
      tasks = tasks.filter((x) => x.id !== id);
      renderApp();
      showToast(`Deleted “${title}”`, "danger");
    };
  })();

  const card = document.querySelector(`.task-card[data-id="${id}"]`);
  if (card) {
    card.classList.add("card-leave");
    card.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 260); // fallback if animations are disabled
  } else {
    finish();
  }
}

/* ==========================================================================
   8. COMPOSER (add / edit form)
   ========================================================================== */
function populateCategorySelect() {
  const select = $("#taskCategory");
  select.innerHTML = CATEGORIES.map((c) => `<option value="${c.key}">${c.label}</option>`).join("");
}

function openComposer() {
  $("#composerForm").hidden = false;
  $("#composerToggle").setAttribute("aria-expanded", "true");
  $("#taskTitle").focus();
}

function closeComposer() {
  $("#composerForm").hidden = true;
  $("#composerToggle").setAttribute("aria-expanded", "false");
  resetComposerForm();
}

function resetComposerForm() {
  $("#composerForm").reset();
  $("#editingId").value = "";
  $("#taskCategory").value = "today";
  $("#taskPriority").value = "medium";
  $("#composerSubmit").textContent = "Add task";
  $("#formError").textContent = "";
}

function openComposerForNew() {
  openComposer();
}

function openComposerForEdit(t) {
  openComposer();
  $("#editingId").value = t.id;
  $("#taskTitle").value = t.title;
  $("#taskDescription").value = t.description || "";
  $("#taskDueDate").value = t.dueDate || "";
  $("#taskPriority").value = t.priority;
  $("#taskCategory").value = t.category;
  $("#composerSubmit").textContent = "Save changes";
  $("#composer").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Lock the form while a request is running so it can't be submitted twice.
function setComposerBusy(on, busyLabel = "") {
  composerBusy = on;
  const submit = $("#composerSubmit");
  submit.disabled = on;
  $("#composerCancel").disabled = on;
  submit.textContent = on ? busyLabel : ($("#editingId").value ? "Save changes" : "Add task");
}

async function handleComposerSubmit(e) {
  e.preventDefault();
  if (composerBusy) return;

  const title = $("#taskTitle").value.trim();
  if (!title) {
    $("#formError").textContent = "Please give your task a title.";
    $("#taskTitle").focus();
    return;
  }

  const payload = {
    title,
    description: $("#taskDescription").value.trim(),
    dueDate: $("#taskDueDate").value || null,
    priority: $("#taskPriority").value,
    category: $("#taskCategory").value,
  };
  const editingId = $("#editingId").value;
  const epoch = auth.epoch;

  $("#formError").textContent = "";
  setComposerBusy(true, editingId ? "Saving…" : "Adding…");
  try {
    if (editingId) {
      const { task } = await apiRequest(`${API_BASE}/tasks/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        body: payload,
      });
      if (epoch !== auth.epoch) return;
      replaceTask(task);
      setComposerBusy(false);
      closeComposer();
      renderApp();
      showToast("Task updated", "success");
    } else {
      const { task } = await apiRequest(`${API_BASE}/tasks`, { method: "POST", body: payload });
      if (epoch !== auth.epoch) return;
      tasks.push(task);
      state.lastAddedId = task.id;
      setComposerBusy(false);
      closeComposer();
      renderApp();
      showToast("Task added", "success");
    }
  } catch (err) {
    if (epoch !== auth.epoch) return;
    // Nothing was saved. Unlock the form and leave everything the person typed in place.
    setComposerBusy(false);
    if (err.status === 400) $("#formError").textContent = err.message;
    if (err.status === 404 && editingId) closeComposer(); // the task being edited no longer exists
    handleTaskError(err);
  }
}

/* ==========================================================================
   9. FILTERS, SEARCH & SORT
   ========================================================================== */
function resetFilters() {
  state.filters = { search: "", status: "all", priority: "all", sort: "dueAsc" };
  $("#searchInput").value = "";
  document.querySelectorAll("#statusChips .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.status === "all"));
  $("#priorityFilter").value = "all";
  $("#sortSelect").value = "dueAsc";
  renderApp();
}

function updateClearFiltersVisibility() {
  const active = isFiltering();
  $("#clearFilters").hidden = !active;
}

/* ==========================================================================
   10. CONFIRM DIALOG
   ========================================================================== */
function closeConfirmDelete(force = false) {
  if (deleteBusy && !force) return; // a delete request is still running
  const overlay = $("#confirmOverlay");
  if (overlay) {
    overlay.hidden = true;
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
  }
  pendingDeleteId = null;
}

/* ==========================================================================
   11. TOASTS
   ========================================================================== */
function showToast(message, type = "info") {
  const container = $("#toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast-dot" aria-hidden="true"></span><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 400); // fallback
  }, 2800);
}

/* ==========================================================================
   12. THEME
   ========================================================================== */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = $("#themeToggle");
  btn.setAttribute("aria-pressed", String(theme === "light"));
  btn.setAttribute("aria-label", theme === "light" ? "Switch to dark mode" : "Switch to light mode");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    console.error("Horizon: failed to save theme", err);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "light" ? "dark" : "light");
}

/* ==========================================================================
   13. EVENT BINDING & INIT
   ========================================================================== */
function $(selector) {
  return document.querySelector(selector);
}

function bindStaticEvents() {
  // Theme
  $("#themeToggle").addEventListener("click", toggleTheme);

  // Account
  $("#logoutBtn").addEventListener("click", handleLogout);
  $("#loadRetry").addEventListener("click", () => { if (retryAction) retryAction(); });

  // Search
  let searchDebounce;
  $("#searchInput").addEventListener("input", (e) => {
    window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(() => {
      state.filters.search = e.target.value.trim().toLowerCase();
      renderApp();
    }, 140);
  });

  // Composer
  $("#composerToggle").addEventListener("click", openComposerForNew);
  $("#composerCancel").addEventListener("click", () => { if (!composerBusy) closeComposer(); });
  $("#composerForm").addEventListener("submit", handleComposerSubmit);
  $("#globalEmptyAdd").addEventListener("click", openComposerForNew);

  // Status chips
  $("#statusChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#statusChips .chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.filters.status = chip.dataset.status;
    renderApp();
  });

  // Priority filter & sort
  $("#priorityFilter").addEventListener("change", (e) => {
    state.filters.priority = e.target.value;
    renderApp();
  });
  $("#sortSelect").addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    renderBoard();
  });

  // Clear filters
  $("#clearFilters").addEventListener("click", resetFilters);
  $("#noResultsClear").addEventListener("click", resetFilters);

  // Confirm dialog
  $("#confirmCancel").addEventListener("click", () => closeConfirmDelete());
  $("#confirmDelete").addEventListener("click", performDelete);
  $("#confirmOverlay").addEventListener("click", (e) => {
    if (e.target.id === "confirmOverlay") closeConfirmDelete();
  });

  // Escape closes whichever overlay is open
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("#confirmOverlay").hidden) closeConfirmDelete();
    else if (!$("#composerForm").hidden && !composerBusy) closeComposer();
  });

  // Horizon quick-nav rail
  $("#horizonRail").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-jump]");
    if (!btn) return;
    document.querySelectorAll(".horizon-stop").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const key = btn.dataset.jump;
    state.collapsed.delete(key);
    saveCollapsedState();
    const section = document.querySelector(`.horizon-section[data-category="${key}"]`);
    if (section) {
      section.classList.remove("is-collapsed");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // Board — click delegation (collapse, complete, edit, delete)
  const board = $("#board");
  board.addEventListener("click", (e) => {
    const header = e.target.closest('[data-action="toggle-collapse"]');
    if (header) {
      toggleCollapse(header.closest(".horizon-section").dataset.category);
      return;
    }
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const card = actionEl.closest(".task-card");
    if (!card) return;
    const id = card.dataset.id;
    const action = actionEl.dataset.action;

    if (action === "toggle") handleToggleComplete(id);
    else if (action === "edit") {
      const t = tasks.find((x) => x.id === id);
      if (t) openComposerForEdit(t);
    } else if (action === "delete") requestDeleteTask(id);
  });

  // Board — keyboard support for collapsible headers
  board.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const header = e.target.closest('[data-action="toggle-collapse"]');
    if (!header) return;
    e.preventDefault();
    toggleCollapse(header.closest(".horizon-section").dataset.category);
  });

  // Board — move-to-category dropdown
  board.addEventListener("change", (e) => {
    if (!e.target.classList.contains("move-select")) return;
    const card = e.target.closest(".task-card");
    if (!card) return;
    moveTaskToCategory(card.dataset.id, e.target.value);
  });

  // Board — drag and drop between sections
  board.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".task-card");
    if (!card) return;
    e.dataTransfer.setData("text/plain", card.dataset.id);
    e.dataTransfer.effectAllowed = "move";
    window.requestAnimationFrame(() => card.classList.add("is-dragging"));
  });
  board.addEventListener("dragend", (e) => {
    const card = e.target.closest(".task-card");
    if (card) card.classList.remove("is-dragging");
    document.querySelectorAll(".horizon-section.drag-over").forEach((s) => s.classList.remove("drag-over"));
  });
  board.addEventListener("dragover", (e) => {
    const section = e.target.closest(".horizon-section");
    if (!section) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    section.classList.add("drag-over");
  });
  board.addEventListener("dragleave", (e) => {
    const section = e.target.closest(".horizon-section");
    if (!section) return;
    if (!section.contains(e.relatedTarget)) section.classList.remove("drag-over");
  });
  board.addEventListener("drop", (e) => {
    const section = e.target.closest(".horizon-section");
    if (!section) return;
    e.preventDefault();
    section.classList.remove("drag-over");
    const id = e.dataTransfer.getData("text/plain");
    moveTaskToCategory(id, section.dataset.category);
  });
}

function toggleCollapse(key) {
  if (state.collapsed.has(key)) state.collapsed.delete(key);
  else state.collapsed.add(key);
  saveCollapsedState();

  const section = document.querySelector(`.horizon-section[data-category="${key}"]`);
  if (!section) return;
  const nowCollapsed = section.classList.toggle("is-collapsed");
  section.querySelector(".horizon-header").setAttribute("aria-expanded", String(!nowCollapsed));
}

/* ==========================================================================
   14. AUTH, VIEWS & SESSION
   Only one screen is visible at a time:
     loading  ->  auth (log in / create account)  ->  app (the dashboard)
   plus an "error" screen with a retry button if the server can't be reached.
   ========================================================================== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let retryAction = null;
let authBusy = false;

function setView(view, { text = "Loading…", message = "", retry = null } = {}) {
  $("#appLoading").hidden = view !== "loading";
  $("#loadError").hidden = view !== "error";
  $("#authMain").hidden = view !== "auth";
  $("#main").hidden = view !== "app";
  $("#navSearch").hidden = view !== "app";
  $(".skip-link").setAttribute("href", view === "auth" ? "#authMain" : "#main");

  if (view === "loading") $("#appLoadingText").textContent = text;
  if (view === "error") {
    $("#loadErrorText").textContent = message || GENERIC_ERROR;
    retryAction = retry;
  }
  updateUserArea();
}

function updateUserArea() {
  const email = auth.user ? auth.user.email : "";
  $("#userEmail").textContent = email;
  $("#userEmail").title = email;
  $("#userAvatar").textContent = email ? email.charAt(0).toUpperCase() : "";
  $("#userArea").hidden = !auth.user;
}

function showAuthMode(mode, { notice = "", focus = true } = {}) {
  const isLogin = mode === "login";
  $("#loginPane").hidden = !isLogin;
  $("#registerPane").hidden = isLogin;
  clearFormErrors($("#loginForm"));
  clearFormErrors($("#registerForm"));

  const noticeEl = $("#authNotice");
  noticeEl.textContent = notice;
  noticeEl.hidden = !notice;

  if (focus) (isLogin ? $("#loginEmail") : $("#registerEmail")).focus();
}

function clearFormErrors(form) {
  form.querySelectorAll("input").forEach((input) => input.removeAttribute("aria-invalid"));
  form.querySelector(".auth-error").textContent = "";
}

function showFormError(form, message, field = null) {
  form.querySelector(".auth-error").textContent = message;
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

// Disable the submit button and change its label while the request runs.
function setAuthBusy(form, on, busyLabel = "") {
  authBusy = on;
  const btn = form.querySelector('button[type="submit"]');
  if (on) {
    btn.dataset.label = btn.textContent;
    btn.textContent = busyLabel;
  } else if (btn.dataset.label) {
    btn.textContent = btn.dataset.label;
  }
  btn.disabled = on;
  form.setAttribute("aria-busy", String(on));
  form.querySelectorAll("input").forEach((input) => { input.readOnly = on; });
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  if (authBusy) return;
  const form = e.currentTarget;
  clearFormErrors(form);

  const emailEl = $("#loginEmail");
  const passwordEl = $("#loginPassword");
  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!EMAIL_RE.test(email)) return showFormError(form, "Please enter a valid email address.", emailEl);
  if (!password) return showFormError(form, "Please enter your password.", passwordEl);

  setAuthBusy(form, true, "Logging in…");
  let user;
  try {
    ({ user } = await apiRequest(`${API_BASE}/auth/login`, { method: "POST", body: { email, password } }));
  } catch (err) {
    setAuthBusy(form, false);
    if (err.status === 401) passwordEl.value = "";
    showFormError(form, err.message, err.status === 401 ? passwordEl : null);
    return;
  }
  setAuthBusy(form, false);
  form.reset();
  await onAuthenticated(user, "Welcome back.");
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  if (authBusy) return;
  const form = e.currentTarget;
  clearFormErrors(form);

  const emailEl = $("#registerEmail");
  const passwordEl = $("#registerPassword");
  const confirmEl = $("#registerConfirm");
  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!EMAIL_RE.test(email)) return showFormError(form, "Please enter a valid email address.", emailEl);
  if (password.length < 8) return showFormError(form, "Password must be at least 8 characters.", passwordEl);
  if (confirmEl.value !== password) return showFormError(form, "Passwords do not match.", confirmEl);

  setAuthBusy(form, true, "Creating account…");
  let user;
  try {
    ({ user } = await apiRequest(`${API_BASE}/auth/register`, {
      method: "POST",
      body: { email, password, confirmPassword: confirmEl.value },
    }));
  } catch (err) {
    setAuthBusy(form, false);
    showFormError(form, err.message, err.status === 409 ? emailEl : null);
    return;
  }
  setAuthBusy(form, false);
  form.reset();
  await onAuthenticated(user, "Account created successfully.");
}

// Someone is logged in: show their name, then load their tasks from the server.
async function onAuthenticated(user, welcomeMessage = "") {
  auth.user = user;
  auth.epoch += 1;
  const loaded = await loadTasksIntoApp();
  if (loaded && welcomeMessage) showToast(welcomeMessage, "success");
}

async function loadTasksIntoApp() {
  const epoch = auth.epoch;
  setView("loading", { text: "Loading your tasks…" });
  try {
    const data = await apiRequest(`${API_BASE}/tasks`);
    if (epoch !== auth.epoch) return false;
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    setView("app");
    renderApp();
    return true;
  } catch (err) {
    // A 401 already switched us to the login screen (and changed the epoch).
    if (epoch !== auth.epoch || err.status === 401) return false;
    setView("error", { message: "We couldn't load your tasks.", retry: loadTasksIntoApp });
    return false;
  }
}

// Re-fetch tasks without a loading screen (used after a "task not found").
async function refreshTasksQuietly() {
  const epoch = auth.epoch;
  try {
    const data = await apiRequest(`${API_BASE}/tasks`);
    if (epoch !== auth.epoch) return;
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    renderApp();
  } catch (err) {
    /* apiRequest already handled an expired session; otherwise keep what we have */
  }
}

// Forget everything about the current person so the next one starts clean —
// including the DOM, so nobody's tasks linger on a shared computer.
function resetAppState() {
  auth.user = null;
  auth.epoch += 1;
  tasks = [];
  pendingIds.clear();
  deleteBusy = false;
  setDeleteBusy(false);
  setComposerBusy(false);
  closeComposer();
  closeConfirmDelete(true);

  state.lastAddedId = null;
  state.filters = { search: "", status: "all", priority: "all", sort: "dueAsc" };
  $("#searchInput").value = "";
  document.querySelectorAll("#statusChips .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.status === "all"));
  $("#priorityFilter").value = "all";
  $("#sortSelect").value = "dueAsc";

  $("#board").innerHTML = "";
  $("#horizonRail").innerHTML = "";
  renderStats();
}

function handleSessionExpired() {
  if (!auth.user) return;
  resetAppState();
  setView("auth");
  showAuthMode("login", { notice: "Your session has expired. Please log in again." });
}

async function handleLogout() {
  const btn = $("#logoutBtn");
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await apiRequest(`${API_BASE}/auth/logout`, { method: "POST", skipSessionExpired: true });
  } catch (err) {
    // A 401 just means the session was already gone — same end result as logging out.
    if (err.status !== 401) {
      btn.disabled = false;
      showToast(err.message || GENERIC_ERROR, "danger");
      return;
    }
  }
  btn.disabled = false;
  resetAppState();
  setView("auth");
  showAuthMode("login");
  showToast("You've been logged out.", "info");
}

// Ask the server who is logged in (the cookie decides) and show the right screen.
async function bootstrapSession() {
  setView("loading", { text: "Loading…" });
  try {
    const data = await apiRequest(`${API_BASE}/auth/me`);
    if (data.authenticated && data.user) {
      await onAuthenticated(data.user);
    } else {
      setView("auth");
      showAuthMode("login");
    }
  } catch (err) {
    setView("error", { message: "We couldn't reach Horizon. Check your connection and try again.", retry: bootstrapSession });
  }
}

function bindAuthEvents() {
  $("#loginForm").addEventListener("submit", handleLoginSubmit);
  $("#registerForm").addEventListener("submit", handleRegisterSubmit);
  document.querySelectorAll("[data-auth-mode]").forEach((btn) => {
    btn.addEventListener("click", () => { if (!authBusy) showAuthMode(btn.dataset.authMode); });
  });
}

function init() {
  initTheme();
  populateCategorySelect();
  state.collapsed = loadCollapsedFromStorage();
  bindStaticEvents();
  bindAuthEvents();
  closeConfirmDelete(true);
  $("#footerYear").textContent = new Date().getFullYear();
  bootstrapSession(); // the session cookie decides: login screen or dashboard
}

document.addEventListener("DOMContentLoaded", init);
