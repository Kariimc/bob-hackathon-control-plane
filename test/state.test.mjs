/**
 * test/state.test.mjs
 *
 * Legacy state-isolation tests — now exercised against lib/store.mjs,
 * which replaced the old lib/state.mjs. The async new store is tested
 * more comprehensively in test/store.test.mjs; these tests exist for
 * backward compatibility with the original test surface.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore } from '../lib/store.mjs';

test('stores are isolated and reset to the baseline', async () => {
  const first = await createStore();
  const second = await createStore();
  await first.advanceTask('inventory');
  assert.equal(first.snapshot().revision, 2);
  assert.equal(second.snapshot().revision, 1);
  assert.equal(second.snapshot().tasks[0].status, 'queued');
});

test('unknown task ids do not change revision', async () => {
  const store = await createStore();
  assert.equal(await store.advanceTask('missing'), 'not_found');
  assert.equal(store.snapshot().revision, 1);
});
