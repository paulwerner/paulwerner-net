// In-memory sliding-window limiter. Single process, low traffic — a Map of
// recent hit timestamps per client is all this needs. req.ip is the visitor
// address because Express trusts Caddy's X-Forwarded-For (trust proxy).
import { isIPv6 } from 'node:net';

// One IPv6 customer typically holds a whole /64, so the limiter counts per
// /64 prefix; IPv4 (including IPv4-mapped IPv6) is counted per address.
export function clientKey(ip = '') {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!isIPv6(ip)) return ip;
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left;
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

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
    const key = clientKey(req.ip);
    const fresh = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (fresh.length >= limit) {
      return res.status(429).json({ error: 'rate_limited' });
    }
    fresh.push(Date.now());
    hits.set(key, fresh);
    next();
  };
}
