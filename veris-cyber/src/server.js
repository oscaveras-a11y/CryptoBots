import http from 'node:http';
import { randomUUID } from 'node:crypto';

export function createServer() {
  return http.createServer(async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true, service: 'veris-cyber', mode: 'demo' });
    if (req.method === 'POST' && req.url === '/api/audits') {
      let body = '';
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 8192) return reply(413, { error: 'payload_too_large' });
        }
        const input = JSON.parse(body);
        if (typeof input.target !== 'string' || !input.target.trim() || input.target.length > 300 || input.authorized !== true || typeof input.scope !== 'string' || !input.scope.trim() || input.scope.length > 1000) {
          return reply(400, { error: 'target_scope_and_authorization_required' });
        }
        return reply(201, { id: randomUUID(), status: 'draft', target: input.target.trim(), scope: input.scope.trim(), active_scan: false, persisted: false });
      } catch { return reply(400, { error: 'invalid_json' }); }
    }
    return reply(404, { error: 'not_found' });
  });
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1].replace(/\\/g, '/')).href) {
  const port = Number(process.env.CYBER_PORT || 3200);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid CYBER_PORT');
  createServer().listen(port, '127.0.0.1', () => console.log('VERIS CYBER local API listening on 127.0.0.1:' + port));
}
