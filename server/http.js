// Small HTTP helpers for the API: JSON bodies, replies, cookies, same-origin checks and rate limits.
export class HttpError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code; }
}

export async function readJson(req, limit = 32 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'TOO_LARGE');
    chunks.push(chunk);
  }
  if (!size) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'BAD_JSON'); }
}

export function sendJson(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(text), ...headers});
  res.end(text);
}

export const parseCookies = header => Object.fromEntries((header || '').split(';').map(p => p.trim()).filter(Boolean)
  .map(p => { const i = p.indexOf('='); return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))]; }));

export const isHttps = req => req.headers['x-forwarded-proto'] === 'https' || (process.env.ASHES_PUBLIC_URL || '').startsWith('https:');

export function cookie(req, name, value, maxAgeSeconds) {
  return [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`,
    ...(isHttps(req) ? ['Secure'] : [])].join('; ');
}

/** State-changing calls must come from our own page: a custom header (forces a CORS preflight) and, if sent, our Origin. */
export function requireSameOrigin(req) {
  if (req.headers['x-ashes'] !== '1') throw new HttpError(403, 'FORBIDDEN');
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'FORBIDDEN');
}

export const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

/** limit(key, max, windowMs) → throws 429 when `key` has been used `max` times in the window. */
export function rateLimiter() {
  const hits = new Map();
  return (key, max, windowMs) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) throw new HttpError(429, 'SLOW_DOWN');
    recent.push(now);
    hits.set(key, recent);
  };
}
