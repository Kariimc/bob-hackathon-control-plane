import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from '../lib/state.mjs';

test('stores are isolated and reset to the baseline', () => {
  const first = createStore();
  const second = createStore();
  first.advanceTask('inventory');
  assert.equal(first.snapshot().revision, 2);
  assert.equal(second.snapshot().revision, 1);
  assert.equal(second.snapshot().tasks[0].status, 'queued');
});

test('unknown task ids do not change revision', () => {
  const store = createStore();
  assert.equal(store.advanceTask('missing'), null);
  assert.equal(store.snapshot().revision, 1);
});
