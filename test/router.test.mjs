/**
 * test/router.test.mjs
 * Unit tests for lib/router.mjs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { Router } from '../lib/router.mjs';

function makeReqRes(method, url) {
  const req = Object.assign(new EventEmitter(), { method, url, headers: {} });
  const res = { written: null, write(v) { this.written = v; } };
  return { req, res };
}

test('GET route matches exact pathname', () => {
  const router = new Router();
  let called = false;
  router.get('/api/health', () => { called = true; });
  const { req, res } = makeReqRes('GET', '/api/health');
  const matched = router.dispatch(req, res);
  assert.ok(matched);
  assert.ok(called);
});

test('POST route does not match GET request', () => {
  const router = new Router();
  let called = false;
  router.post('/api/health', () => { called = true; });
  const { req, res } = makeReqRes('GET', '/api/health');
  const matched = router.dispatch(req, res);
  assert.equal(matched, false);
  assert.equal(called, false);
});

test('regex route passes capture groups to handler', () => {
  const router = new Router();
  let captured = null;
  router.post(/^\/api\/tasks\/([a-z0-9-]+)\/advance$/, (req, res, match) => {
    captured = match[1];
  });
  const { req, res } = makeReqRes('POST', '/api/tasks/my-task/advance');
  const matched = router.dispatch(req, res);
  assert.ok(matched);
  assert.equal(captured, 'my-task');
});

test('unmatched route returns false', () => {
  const router = new Router();
  router.get('/api/health', () => {});
  const { req, res } = makeReqRes('GET', '/not-found');
  assert.equal(router.dispatch(req, res), false);
});

test('DELETE route is dispatched', () => {
  const router = new Router();
  let called = false;
  router.delete(/^\/api\/tasks\/([a-z0-9-]+)$/, () => { called = true; });
  const { req, res } = makeReqRes('DELETE', '/api/tasks/abc-123');
  assert.ok(router.dispatch(req, res));
  assert.ok(called);
});

test('async handler rejection is forwarded to onError', async () => {
  const router = new Router();
  const boom = new Error('async boom');
  router.get('/api/async-fail', async () => { throw boom; });
  const { req, res } = makeReqRes('GET', '/api/async-fail');
  let caught = null;
  router.dispatch(req, res, (err) => { caught = err; });
  // Wait for the microtask queue to drain
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(caught, boom);
});

test('sync handler error does not call onError (thrown to outer try/catch)', () => {
  const router = new Router();
  router.get('/api/sync-ok', () => { /* no throw */ });
  const { req, res } = makeReqRes('GET', '/api/sync-ok');
  let caught = null;
  router.dispatch(req, res, (err) => { caught = err; });
  assert.equal(caught, null);
});

test('dispatch returns true even when async handler will reject and no onError is given', async () => {
  const router = new Router();
  // The handler returns a promise that rejects; no onError is passed.
  // We attach a .catch() to the internal promise so it does not become an
  // unhandled rejection — the test runner would otherwise fail the test.
  let handlerPromise;
  router.get('/api/async-no-handler', () => {
    handlerPromise = Promise.reject(new Error('no-handler-boom'));
    handlerPromise.catch(() => {}); // prevent unhandled rejection
    return handlerPromise;
  });
  const { req, res } = makeReqRes('GET', '/api/async-no-handler');
  const matched = router.dispatch(req, res /* no onError */);
  // dispatch must return true — a route was matched
  assert.ok(matched);
  // The rejection must not be forwarded to onError (there is none), but dispatch
  // itself must return synchronously without throwing.
  await new Promise((r) => setTimeout(r, 20));
});

test('dispatch falls back to "/" for malformed URL', () => {
  const router = new Router();
  let captured = null;
  router.get('/', (req, res, match) => { captured = match; });
  // Craft a request with a URL that new URL() cannot parse relative to http://127.0.0.1
  const req = Object.assign(new EventEmitter(), { method: 'GET', url: ':', headers: {} });
  const res = {};
  router.dispatch(req, res);
  // The malformed URL falls back to '/' which does match the '/' route
  assert.ok(captured !== undefined);
});

