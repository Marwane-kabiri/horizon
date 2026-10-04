// Gatekeeper for protected routes. The user id comes ONLY from the server-side
// session (which the browser can't edit) — never from the request body or URL.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Please log in to continue.' });
}

module.exports = { requireAuth };
