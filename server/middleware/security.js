// Extra CSRF protection on top of SameSite cookies.
// Browsers attach an Origin header to cross-site POST/PUT/DELETE requests.
// If it is present and does not match this server, reject the request.
// (Requests with no Origin header — curl, tests, same-origin GETs — pass through.)
function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const origin = req.get('origin');
  if (!origin) return next();

  try {
    if (new URL(origin).host === req.get('host')) return next();
  } catch (_) {
    /* malformed Origin header — fall through to rejection */
  }
  return res.status(403).json({ error: 'Cross-origin request blocked.' });
}

// Auth and task responses are personal. Tell browsers and proxies not to cache them.
function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

module.exports = { sameOriginOnly, noStore };
