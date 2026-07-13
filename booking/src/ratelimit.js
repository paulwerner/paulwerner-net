// In-memory sliding-window limiter. Single process, low traffic — a Map of
// recent hit timestamps per IP is all this needs. req.ip is the visitor
// address because Express trusts Caddy's X-Forwarded-For (trust proxy).
export function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();

  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, stamps] of hits) {
      const fresh = stamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(ip);
      else hits.set(ip, fresh);
    }
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const cutoff = Date.now() - windowMs;
    const fresh = (hits.get(req.ip) ?? []).filter((t) => t > cutoff);
    if (fresh.length >= limit) {
      return res.status(429).json({ error: 'rate_limited' });
    }
    fresh.push(Date.now());
    hits.set(req.ip, fresh);
    next();
  };
}
