/**
 * test/api.test.mjs
 * Integration tests for all new API routes added in the modernisation:
 *   POST /api/tasks          — create
 *   POST /api/tasks/:id/block
 *   POST /api/tasks/:id/fail
 *   POST /api/tasks/:id/reset
 *   DELETE /api/tasks/:id
 *   GET  /api/metrics
 *   GET  /api/stream          (SSE)
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createAppServer } from '../server.mjs';

let server;
let origin;

before(async () => {
  server = await createAppServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

// ---------------------------------------------------------------------------
// POST /api/tasks — create
// ---------------------------------------------------------------------------

test('POST /api/tasks creates a new task', async () => {
  const res = await fetch(`${origin}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'New job', owner: 'Alice' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.task.title, 'New job');
  assert.equal(body.task.owner, 'Alice');
  assert.equal(body.task.status, 'queued');
  assert.ok(typeof body.task.id === 'string');
});

test('POST /api/tasks rejects missing title', async () => {
  const res = await fetch(`${origin}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: 'Bob' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /title/);
});

test('POST /api/tasks rejects non-JSON body', async () => {
  const res = await fetch(`${origin}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/block
// ---------------------------------------------------------------------------

test('POST /api/tasks/:id/block marks task as blocked', async () => {
  const res = await fetch(`${origin}/api/tasks/inventory/block`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'waiting on review' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.task.status, 'blocked');
  assert.equal(body.task.reason, 'waiting on review');
});

test('POST /api/tasks/:id/block returns 404 for unknown task', async () => {
  const res = await fetch(`${origin}/api/tasks/ghost/block`, { method: 'POST' });
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/fail
// ---------------------------------------------------------------------------

test('POST /api/tasks/:id/fail marks task as failed', async () => {
  const res = await fetch(`${origin}/api/tasks/policy/fail`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'lint error' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.task.status, 'failed');
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/reset
// ---------------------------------------------------------------------------

test('POST /api/tasks/:id/reset returns task to queued', async () => {
  // preview is 'done' in seed
  const res = await fetch(`${origin}/api/tasks/preview/reset`, { method: 'POST' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.task.status, 'queued');
});

test('POST /api/tasks/:id/reset returns 404 for unknown task', async () => {
  const res = await fetch(`${origin}/api/tasks/ghost/reset`, { method: 'POST' });
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// ---------------------------------------------------------------------------

test('DELETE /api/tasks/:id removes a task', async () => {
  // First create a task we can safely delete.
  const create = await fetch(`${origin}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Temp task', owner: 'CI' }),
  });
  const { task } = await create.json();

  const del = await fetch(`${origin}/api/tasks/${task.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.deepEqual(await del.json(), { ok: true });
});

test('DELETE /api/tasks/:id returns 404 for unknown task', async () => {
  const res = await fetch(`${origin}/api/tasks/ghost`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/advance — 409 for wrong state
// ---------------------------------------------------------------------------

test('POST /api/tasks/:id/advance returns 409 for wrong-state task', async () => {
  // deploy-dry is 'failed' in the seed — cannot advance
  const res = await fetch(`${origin}/api/tasks/deploy-dry/advance`, { method: 'POST' });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.match(body.error, /cannot be advanced/);
});

test('POST /api/tasks/:id/advance returns 404 for unknown task', async () => {
  const res = await fetch(`${origin}/api/tasks/ghost/advance`, { method: 'POST' });
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// POST /api/tasks — task limit
// ---------------------------------------------------------------------------

test('POST /api/tasks returns 422 when task limit is reached', async () => {
  // Create tasks up to the 200 limit via the store directly (fast path).
  const store = server._store;
  const current = store.snapshot().tasks.length; // 5 seed tasks
  for (let i = current; i < 200; i += 1) {
    await store.createTask({ title: `Filler ${i}`, owner: 'CI' });
  }
  const res = await fetch(`${origin}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Over limit', owner: 'CI' }),
  });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.match(body.error, /limit/i);
});

// ---------------------------------------------------------------------------
// GET /api/metrics
// ---------------------------------------------------------------------------

test('GET /api/metrics returns expected shape', async () => {
  const res = await fetch(`${origin}/api/metrics`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(typeof body.uptime_s === 'number');
  assert.ok(typeof body.requests_total === 'number');
  assert.ok(body.requests_total > 0);
  assert.ok(typeof body.requests_by_route === 'object');
  assert.ok(typeof body.tasks_by_status === 'object');
  assert.ok(typeof body.store_revision === 'number');
});

// ---------------------------------------------------------------------------
// GET /api/stream (SSE)
// ---------------------------------------------------------------------------

test('GET /api/stream delivers an initial snapshot event', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${origin}/api/stream`, { signal: controller.signal });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);

    // Read the first chunk — should contain the snapshot event.
    const reader = res.body.getReader();
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    assert.match(chunk, /event: snapshot/);
    assert.match(chunk, /data:/);
    reader.cancel();
  } finally {
    clearTimeout(timeout);
  }
});

test('GET /api/stream pushes event when a task is mutated', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${origin}/api/stream`, { signal: controller.signal });
    const reader = res.body.getReader();

    // Drain the initial snapshot.
    await reader.read();

    // Trigger a mutation.
    await fetch(`${origin}/api/tasks/preview/reset`, { method: 'POST' });

    // The next chunk should be a push event.
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    assert.match(chunk, /event: snapshot/);
    reader.cancel();
  } finally {
    clearTimeout(timeout);
  }
});
