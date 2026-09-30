import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStore } from './lib/state.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(root, 'public');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

const securityHeaders = Object.freeze({
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
});

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(value));
}

async function sendStatic(response, pathname) {
  const entry = staticFiles.get(pathname);
  if (!entry) return false;
  const [filename, contentType] = entry;
  const path = join(publicRoot, filename);
  const details = await stat(path);
  response.writeHead(200, {
    ...securityHeaders,
    'cache-control': 'no-store',
    'content-length': details.size,
    'content-type': contentType,
  });
  createReadStream(path).pipe(response);
  return true;
}

export function createAppServer({ store = createStore() } = {}) {
  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');

      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, {
          ok: true,
          service: 'bob-hackathon-control-plane',
          network: 'loopback-only',
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/snapshot') {
        sendJson(response, 200, store.snapshot());
        return;
      }

      const hasBody = (request.headers['content-length'] !== undefined
          && request.headers['content-length'] !== '0')
        || request.headers['transfer-encoding'] !== undefined;
      if (request.method === 'POST' && hasBody) {
        request.resume();
        sendJson(response, 400, { error: 'Request body not allowed' });
        return;
      }

      const match = request.method === 'POST'
        ? url.pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/advance$/)
        : null;
      if (match) {
        const task = store.advanceTask(match[1]);
        if (!task) {
          sendJson(response, 404, { error: 'Task not found' });
          return;
        }
        sendJson(response, 200, { task });
        return;
      }

      if (request.method === 'GET' && await sendStatic(response, url.pathname)) {
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch {
      sendJson(response, 500, { error: 'Local server error' });
    }
  });
}

export function startServer({ port = Number(process.env.APP_PORT || 8787) } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('APP_PORT must be an integer between 0 and 65535');
  }
  const server = createAppServer();
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    process.stdout.write(`Local dashboard: http://127.0.0.1:${actualPort}\n`);
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
