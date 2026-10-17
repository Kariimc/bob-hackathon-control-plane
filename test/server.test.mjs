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
  assert.equal(body.tasks.length, 5);
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

test('advance on a done task returns 409 Conflict', async () => {
  // preview is 'done' in the seed — cannot advance
  const response = await fetch(`${origin}/api/tasks/preview/advance`, { method: 'POST' });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.match(body.error, /cannot be advanced/);
});

test('dashboard static files are served locally', async () => {
  const response = await fetch(origin);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /Local Control Plane/);
  assert.match(body, /\/app\.js/);
});

test('/office serves the 3D agent office page', async () => {
  const response = await fetch(`${origin}/office`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /Agent Office/);
  assert.match(body, /office\.js/);
  // Office uses the strict loopback-only CSP (pure Canvas 2D, no CDN)
  const csp = response.headers.get('content-security-policy');
  assert.ok(!csp.includes('cdn.jsdelivr.net'), 'office CSP must not allow CDN');
  assert.match(csp, /default-src 'self'/);
});

test('/office.js is served with strict CSP', async () => {
  const response = await fetch(`${origin}/office.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  const csp = response.headers.get('content-security-policy');
  assert.ok(!csp.includes('cdn.jsdelivr.net'), 'office.js CSP must not allow CDN');
  assert.match(csp, /default-src 'self'/);
});

test('dashboard page retains strict CSP (no CDN)', async () => {
  const response = await fetch(origin);
  const csp = response.headers.get('content-security-policy');
  assert.ok(!csp.includes('cdn.jsdelivr.net'), 'dashboard CSP must not allow CDN');
});
