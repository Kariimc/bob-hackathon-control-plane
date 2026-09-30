import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createAppServer } from '../server.mjs';

let server;
let origin;

before(async () => {
  server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.equal(typeof address, 'object');
  assert.equal(address.address, '127.0.0.1');
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('health endpoint reports the loopback boundary', async () => {
  const response = await fetch(`${origin}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'bob-hackathon-control-plane',
    network: 'loopback-only',
  });
});

test('snapshot contains only generic mock state', async () => {
  const response = await fetch(`${origin}/api/snapshot`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.project.mode, 'Local mock');
  assert.equal(body.tasks.length, 3);
  assert.equal(body.revision, 1);
});

test('a mock task advances in memory', async () => {
  const response = await fetch(`${origin}/api/tasks/inventory/advance`, { method: 'POST' });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.task.status, 'running');
  assert.equal(body.task.revision, 2);
});

test('task updates reject request bodies', async () => {
  const response = await fetch(`${origin}/api/tasks/policy/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ unexpected: true }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Request body not allowed' });
});

test('unknown tasks and paths fail closed', async () => {
  const taskResponse = await fetch(`${origin}/api/tasks/missing/advance`, { method: 'POST' });
  const pathResponse = await fetch(`${origin}/not-a-route`);
  assert.equal(taskResponse.status, 404);
  assert.equal(pathResponse.status, 404);
  assert.deepEqual(await pathResponse.json(), { error: 'Not found' });
});

test('dashboard static files are served locally', async () => {
  const response = await fetch(origin);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /Local Control Plane/);
  assert.match(body, /\/app\.js/);
});
