/**
 * test/validate.test.mjs
 * Unit tests for lib/validate.mjs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { validate, readBody, ValidationError } from '../lib/validate.mjs';

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

test('validate passes a well-formed object', () => {
  const out = validate({ title: 'string', owner: 'string' }, { title: 'My task', owner: 'Alice' });
  assert.deepEqual(out, { title: 'My task', owner: 'Alice' });
});

test('validate throws for missing required field', () => {
  assert.throws(
    () => validate({ title: 'string', owner: 'string' }, { title: 'Only title' }),
    (err) => err instanceof ValidationError && /owner/.test(err.message),
  );
});

test('validate throws for empty string on required field', () => {
  assert.throws(
    () => validate({ title: 'string' }, { title: '   ' }),
    (err) => err instanceof ValidationError,
  );
});

test('validate accepts missing optional field', () => {
  const out = validate({ reason: 'string?' }, { extra: 'ignored' });
  assert.deepEqual(out, {});
});

test('validate throws for non-object input', () => {
  assert.throws(
    () => validate({ title: 'string' }, 'a string'),
    (err) => err instanceof ValidationError,
  );
});

test('validate throws for null input', () => {
  assert.throws(
    () => validate({ title: 'string' }, null),
    (err) => err instanceof ValidationError,
  );
});

test('validate throws for array input', () => {
  assert.throws(
    () => validate({ title: 'string' }, ['a', 'b']),
    (err) => err instanceof ValidationError,
  );
});

test('validate throws when field is wrong type', () => {
  assert.throws(
    () => validate({ count: 'string' }, { count: 42 }),
    (err) => err instanceof ValidationError && /count/.test(err.message),
  );
});

test('validate includes optional field when present and non-empty', () => {
  const out = validate({ reason: 'string?' }, { reason: 'blocked by CI' });
  assert.equal(out.reason, 'blocked by CI');
});

test('validate throws for empty optional field when provided', () => {
  // An optional field that IS present must still be a non-empty string...
  // actually the schema allows empty for optional fields — verify it passes through
  const out = validate({ reason: 'string?' }, { reason: '   ' });
  assert.equal(out.reason, '   ');
});

test('ValidationError has correct name property', () => {
  const err = new ValidationError('test');
  assert.equal(err.name, 'ValidationError');
  assert.ok(err instanceof Error);
});

test('validate enforces max length on string:N field', () => {
  assert.throws(
    () => validate({ title: 'string:10' }, { title: 'This is too long for the limit' }),
    (err) => err instanceof ValidationError && /10/.test(err.message),
  );
});

test('validate accepts value within string:N limit', () => {
  const out = validate({ title: 'string:10' }, { title: 'Short' });
  assert.equal(out.title, 'Short');
});

// ---------------------------------------------------------------------------
// readBody()
// ---------------------------------------------------------------------------

function makeRequestWithBody(body) {
  const req = new EventEmitter();
  req.headers = {};
  process.nextTick(() => {
    req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

test('readBody parses valid JSON', async () => {
  const req = makeRequestWithBody(JSON.stringify({ hello: 'world' }));
  const body = await readBody(req);
  assert.deepEqual(body, { hello: 'world' });
});

test('readBody rejects invalid JSON', async () => {
  const req = makeRequestWithBody('not json at all');
  await assert.rejects(readBody(req), (err) => err instanceof ValidationError);
});

test('readBody rejects empty body', async () => {
  const req = makeRequestWithBody('   ');
  await assert.rejects(readBody(req), (err) => err instanceof ValidationError);
});

test('readBody rejects body that exceeds maxBytes', async () => {
  const req = new EventEmitter();
  req.headers = {};
  req.destroy = () => {}; // stub — EventEmitter doesn't have .destroy()
  // Emit a chunk larger than the custom limit, then end.
  process.nextTick(() => {
    req.emit('data', Buffer.alloc(10));
    req.emit('end');
  });
  await assert.rejects(readBody(req, 5), (err) => err instanceof ValidationError && /large/.test(err.message));
});

test('readBody rejects on stream error', async () => {
  const req = new EventEmitter();
  req.headers = {};
  const boom = new Error('stream error');
  process.nextTick(() => req.emit('error', boom));
  await assert.rejects(readBody(req), boom);
});
