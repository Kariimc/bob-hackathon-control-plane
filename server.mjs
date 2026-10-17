import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createStore } from './lib/store.mjs';
import { Router } from './lib/router.mjs';
import { readBody, validate, ValidationError } from './lib/validate.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(root, 'public');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/office', ['office.html', 'text/html; charset=utf-8']],
  ['/office.js', ['office.js', 'text/javascript; charset=utf-8']],
  ['/three.min.js', ['three.min.js', 'text/javascript; charset=utf-8']],
]);

// All routes use the strict loopback-only CSP.
// Three.js is vendored locally — no external scripts needed.
const securityHeaders = Object.freeze({
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
});

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

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
  const path = resolve(join(publicRoot, filename));
  // Path-traversal guard: resolved path must remain inside publicRoot.
  if (!path.startsWith(resolve(publicRoot))) return false;
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

// ---------------------------------------------------------------------------
// Metrics counter
// ---------------------------------------------------------------------------

function createMetrics(startTime) {
  const counters = new Map();
  return {
    increment(label) {
      counters.set(label, (counters.get(label) ?? 0) + 1);
    },
    snapshot(storeRevision, statusCounts, sseConnections) {
      return {
        uptime_s: Math.floor((Date.now() - startTime) / 1000),
        requests_total: [...counters.values()].reduce((a, b) => a + b, 0),
        requests_by_route: Object.fromEntries(counters),
        tasks_by_status: statusCounts,
        store_revision: storeRevision,
        sse_connections: sseConnections,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// SSE broadcast
// ---------------------------------------------------------------------------

function createBroadcaster() {
  const clients = new Set();
  return {
    add(response) { clients.add(response); },
    remove(response) { clients.delete(response); },
    broadcast(event, data) {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of clients) {
        try { res.write(payload); } catch { clients.delete(res); }
      }
    },
    get size() { return clients.size; },
  };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export async function createAppServer({ store, storePath } = {}) {
  if (!store) {
    store = await createStore({ path: storePath ?? null });
  }

  const metrics = createMetrics(Date.now());
  const broadcaster = createBroadcaster();

  // Push a snapshot to all SSE clients on every store mutation.
  store.on('change', () => {
    broadcaster.broadcast('snapshot', store.snapshot());
  });

  const router = new Router();

  // -------------------------------------------------------------------------
  // GET /api/health
  // -------------------------------------------------------------------------
  router.get('/api/health', (req, res) => {
    metrics.increment('GET /api/health');
    sendJson(res, 200, {
      ok: true,
      service: 'bob-hackathon-control-plane',
      network: 'loopback-only',
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/snapshot
  // -------------------------------------------------------------------------
  router.get('/api/snapshot', (req, res) => {
    metrics.increment('GET /api/snapshot');
    sendJson(res, 200, store.snapshot());
  });

  // -------------------------------------------------------------------------
  // GET /api/metrics
  // -------------------------------------------------------------------------
  router.get('/api/metrics', (req, res) => {
    metrics.increment('GET /api/metrics');
    sendJson(res, 200, metrics.snapshot(store.revision, store.statusCounts(), broadcaster.size));
  });

  // -------------------------------------------------------------------------
  // GET /api/stream  (Server-Sent Events)
  // -------------------------------------------------------------------------
  router.get('/api/stream', (req, res) => {
    metrics.increment('GET /api/stream');
    res.writeHead(200, {
      ...securityHeaders,
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });

    // Send current snapshot immediately so the client has data on connect.
    res.write(`event: snapshot\ndata: ${JSON.stringify(store.snapshot())}\n\n`);

    // Heartbeat every 15 s to keep the connection alive through proxies.
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
    }, 15_000);

    broadcaster.add(res);

    req.on('close', () => {
      clearInterval(heartbeat);
      broadcaster.remove(res);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/tasks  (create)
  // -------------------------------------------------------------------------
  router.post('/api/tasks', async (req, res) => {
    metrics.increment('POST /api/tasks');
    try {
      const body = await readBody(req);
      const { title, owner } = validate(
        { title: 'string:200', owner: 'string:100' },
        body,
      );
      const result = await store.createTask({ title, owner });
      if (result === 'limit_reached') {
        sendJson(res, 422, { error: 'Task limit reached — delete existing tasks first' });
        return;
      }
      sendJson(res, 201, { task: result });
    } catch (err) {
      if (err instanceof ValidationError) {
        sendJson(res, 400, { error: err.message });
      } else {
        throw err;
      }
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/tasks/:id/advance  — bodies are not accepted
  // -------------------------------------------------------------------------
  router.post(/^\/api\/tasks\/([a-z0-9_-]+)\/advance$/, async (req, res, match) => {
    metrics.increment('POST /api/tasks/:id/advance');
    const hasBody = (req.headers['content-length'] !== undefined
        && req.headers['content-length'] !== '0')
      || req.headers['transfer-encoding'] !== undefined;
    if (hasBody) {
      req.resume();
      sendJson(res, 400, { error: 'Request body not allowed' });
      return;
    }
    const result = await store.advanceTask(match[1]);
    if (result === 'not_found') {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    if (result === 'wrong_state') {
      sendJson(res, 409, { error: 'Task cannot be advanced from its current state' });
      return;
    }
    sendJson(res, 200, { task: result });
  });

  // -------------------------------------------------------------------------
  // POST /api/tasks/:id/block
  // -------------------------------------------------------------------------
  router.post(/^\/api\/tasks\/([a-z0-9_-]+)\/block$/, async (req, res, match) => {
    metrics.increment('POST /api/tasks/:id/block');
    try {
      const body = await readBody(req).catch(() => ({}));
      const fields = typeof body === 'object' && body !== null ? body : {};
      const rawReason = typeof fields.reason === 'string' ? fields.reason : '';
      const reason = rawReason.slice(0, 500);
      const task = await store.blockTask(match[1], reason);
      if (!task) {
        sendJson(res, 404, { error: 'Task not found' });
        return;
      }
      sendJson(res, 200, { task });
    } catch (err) {
      if (err instanceof ValidationError) {
        sendJson(res, 400, { error: err.message });
      } else {
        throw err;
      }
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/tasks/:id/fail
  // -------------------------------------------------------------------------
  router.post(/^\/api\/tasks\/([a-z0-9_-]+)\/fail$/, async (req, res, match) => {
    metrics.increment('POST /api/tasks/:id/fail');
    try {
      const body = await readBody(req).catch(() => ({}));
      const fields = typeof body === 'object' && body !== null ? body : {};
      const rawReason = typeof fields.reason === 'string' ? fields.reason : '';
      const reason = rawReason.slice(0, 500);
      const task = await store.failTask(match[1], reason);
      if (!task) {
        sendJson(res, 404, { error: 'Task not found' });
        return;
      }
      sendJson(res, 200, { task });
    } catch (err) {
      if (err instanceof ValidationError) {
        sendJson(res, 400, { error: err.message });
      } else {
        throw err;
      }
    }
  });

  // -------------------------------------------------------------------------
  // POST /api/tasks/:id/reset
  // -------------------------------------------------------------------------
  router.post(/^\/api\/tasks\/([a-z0-9_-]+)\/reset$/, async (req, res, match) => {
    metrics.increment('POST /api/tasks/:id/reset');
    const task = await store.resetTask(match[1]);
    if (!task) {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    sendJson(res, 200, { task });
  });

  // -------------------------------------------------------------------------
  // GET /api/sim  — query simulation state
  // -------------------------------------------------------------------------
  let simInterval = null;
  let simEnabled = false;

  function runSimStep() {
    const snap = store.snapshot();
    const live = snap.tasks;
    // Pick one queued or running task and advance it; reset any done/failed after a delay
    const runnable = live.filter(t => t.status === 'queued' || t.status === 'running');
    if (runnable.length > 0) {
      const pick = runnable[Math.floor(Math.random() * runnable.length)];
      store.advanceTask(pick.id);
    } else {
      // All tasks terminal — reset one randomly to restart the cycle
      const terminal = live.filter(t => t.status === 'done' || t.status === 'failed' || t.status === 'blocked');
      if (terminal.length > 0) {
        const pick = terminal[Math.floor(Math.random() * terminal.length)];
        store.resetTask(pick.id);
      }
    }
  }

  function startSim() {
    if (simInterval) return;
    simEnabled = true;
    simInterval = setInterval(runSimStep, 2200);
  }
  function stopSim() {
    simEnabled = false;
    if (simInterval) { clearInterval(simInterval); simInterval = null; }
  }

  router.get('/api/sim', (req, res) => {
    metrics.increment('GET /api/sim');
    sendJson(res, 200, { enabled: simEnabled });
  });

  // -------------------------------------------------------------------------
  // POST /api/sim  — toggle simulation on/off
  // -------------------------------------------------------------------------
  router.post('/api/sim', (req, res) => {
    metrics.increment('POST /api/sim');
    req.resume(); // drain any body
    if (simEnabled) { stopSim(); } else { startSim(); }
    sendJson(res, 200, { enabled: simEnabled });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/tasks/:id
  // -------------------------------------------------------------------------
  router.delete(/^\/api\/tasks\/([a-z0-9_-]+)$/, async (req, res, match) => {
    metrics.increment('DELETE /api/tasks/:id');
    const removed = await store.deleteTask(match[1]);
    if (!removed) {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    sendJson(res, 200, { ok: true });
  });

  // -------------------------------------------------------------------------
  // HTTP server
  // -------------------------------------------------------------------------
  const server = createHttpServer(async (request, response) => {
    const handleError = (error) => {
      // Log the real error server-side but never echo internal details to the client.
      process.stderr.write(`[server] unhandled error: ${error?.message ?? error}\n`);
      if (!response.headersSent) {
        sendJson(response, 500, { error: 'Internal server error' });
      }
    };

    try {
      // Dispatch to registered routes first, forwarding async errors.
      if (router.dispatch(request, response, handleError)) return;

      // Static files (GET only).
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && await sendStatic(response, url.pathname)) return;

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      handleError(error);
    }
  });

  // Attach store and broadcaster so tests can inspect them.
  server._store = store;
  server._broadcaster = broadcaster;
  server._stopSim = stopSim;
  return server;
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

export async function startServer({ port = Number(process.env.APP_PORT || 8787), storePath } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('APP_PORT must be an integer between 0 and 65535');
  }
  // Resolve persistence path: explicit argument → STORE_PATH env var → null (in-memory).
  const resolvedStorePath = storePath ?? process.env.STORE_PATH ?? null;
  const server = await createAppServer({ storePath: resolvedStorePath });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    process.stdout.write(`Local dashboard: http://127.0.0.1:${actualPort}\n`);
  });
  const shutdown = () => {
    server._stopSim?.();
    server._store?.destroy();
    server.closeAllConnections();
    server.close(() => process.exit(0));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
