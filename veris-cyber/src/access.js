import { createHash, timingSafeEqual } from 'node:crypto';
export function validApiToken(token) { return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token); }
export function createAccessGuard(token) {
  if (!validApiToken(token)) throw new Error('api_token_required');
  const expected = createHash('sha256').update(token).digest();
  return function authorize(req) {
    const port = req.socket.localPort;
    const hosts = new Set(['127.0.0.1:' + port, 'localhost:' + port, '[::1]:' + port]);
    const host = req.headers.host;
    if (!hosts.has(host)) return {status:403, error:'local_host_required'};
    if (req.headers.origin && req.headers.origin !== 'http://' + host) return {status:403, error:'origin_not_allowed'};
    const header = req.headers.authorization;
    const credential = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!validApiToken(credential) || !timingSafeEqual(expected, createHash('sha256').update(credential).digest())) return {status:401, error:'authentication_required'};
    return null;
  };
}
