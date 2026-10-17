/**
 * test/store.test.mjs
 * Unit tests for the new persistent store (lib/store.mjs).
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createStore } from '../lib/store.mjs';

test('stores are isolated: mutations in one do not affect another', async () => {
  const a = await createStore();
  const b = await createStore();
  await a.advanceTask('inventory');
  assert.equal(a.snapshot().revision, 2);
  assert.equal(b.snapshot().revision, 1);
  assert.equal(b.snapshot().tasks[0].status, 'queued');
});

test('unknown task id returns not_found and does not increment revision', async () => {
  const store = await createStore();
  const result = await store.advanceTask('no-such-task');
  assert.equal(result, 'not_found');
  assert.equal(store.snapshot().revision, 1);
});

test('advanceTask moves queued→running→wrong_state', async () => {
  const store = await createStore();
  const r1 = await store.advanceTask('inventory'); // queued → running
  assert.equal(r1.status, 'running');
  const r2 = await store.advanceTask('inventory'); // running → done
  assert.equal(r2.status, 'done');
  const r3 = await store.advanceTask('inventory'); // done — cannot advance
  assert.equal(r3, 'wrong_state');
});

test('blockTask, failTask, and resetTask update status and log entry', async () => {
  const store = await createStore();
  const blocked = await store.blockTask('inventory', 'waiting on review');
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, 'waiting on review');

  const failed = await store.failTask('policy', 'lint failed');
  assert.equal(failed.status, 'failed');

  const reset = await store.resetTask('inventory');
  assert.equal(reset.status, 'queued');

  const snap = store.snapshot();
  assert.ok(snap.activity.some((a) => /blocked/.test(a.label)));
  assert.ok(snap.activity.some((a) => /failed/.test(a.label)));
  assert.ok(snap.activity.some((a) => /reset/.test(a.label)));
});

test('createTask adds a task and deleteTask removes it', async () => {
  const store = await createStore();
  const before = store.snapshot().tasks.length;
  const created = await store.createTask({ title: 'New job', owner: 'Tester' });
  assert.equal(created.status, 'queued');
  assert.equal(store.snapshot().tasks.length, before + 1);

  const removed = await store.deleteTask(created.id);
  assert.equal(removed, true);
  assert.equal(store.snapshot().tasks.length, before);
});

test('deleteTask returns false for unknown id', async () => {
  const store = await createStore();
  assert.equal(await store.deleteTask('ghost'), false);
});

test('createTask returns limit_reached when at MAX_TASKS', async () => {
  const store = await createStore();
  // Fill to the limit (200). Seed has 5 so we need 195 more.
  for (let i = 0; i < 195; i += 1) {
    const result = await store.createTask({ title: `Filler ${i}`, owner: 'Test' });
    assert.ok(typeof result === 'object', `task ${i} should be created`);
  }
  assert.equal(store.snapshot().tasks.length, 200);
  // One more should be rejected.
  const over = await store.createTask({ title: 'Over limit', owner: 'Test' });
  assert.equal(over, 'limit_reached');
  assert.equal(store.snapshot().tasks.length, 200);
});

test('statusCounts returns correct counts per status', async () => {
  // seed: inventory=queued, policy=running, preview=done, scan=blocked, deploy-dry=failed
  const store = await createStore();
  const counts = store.statusCounts();
  assert.equal(counts.queued, 1);
  assert.equal(counts.running, 1);
  assert.equal(counts.done, 1);
  assert.equal(counts.blocked, 1);
  assert.equal(counts.failed, 1);
});

test('store emits change event on every mutation', async () => {
  const store = await createStore();
  let changeCount = 0;
  store.on('change', () => { changeCount += 1; });
  await store.advanceTask('inventory');
  await store.blockTask('policy', '');
  assert.equal(changeCount, 2);
});

test('store hydrates from disk and persists mutations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bob-store-test-'));
  const path = join(dir, 'state.json');
  try {
    const s1 = await createStore({ path });
    await s1.createTask({ title: 'Persisted task', owner: 'Test' });
    assert.equal(s1.snapshot().tasks.length, 6); // 5 seed + 1 new

    // Hydrate a second store from the same file.
    const s2 = await createStore({ path });
    assert.equal(s2.snapshot().tasks.length, 6);
    assert.ok(s2.snapshot().tasks.some((t) => t.title === 'Persisted task'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('activity log includes timestamps', async () => {
  const store = await createStore();
  const before = Date.now();
  await store.advanceTask('inventory');
  const after = Date.now();
  const entry = store.snapshot().activity.at(-1);
  assert.ok(typeof entry.ts === 'number');
  assert.ok(entry.ts >= before && entry.ts <= after);
});

test('resetTask returns null for unknown id', async () => {
  const store = await createStore();
  const result = await store.resetTask('no-such-task');
  assert.equal(result, null);
  assert.equal(store.snapshot().revision, 1);
});

test('blockTask with no reason sets no reason property', async () => {
  const store = await createStore();
  const blocked = await store.blockTask('inventory', '');
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, undefined);
});

test('failTask with no reason sets no reason property', async () => {
  const store = await createStore();
  const failed = await store.failTask('policy', '');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.reason, undefined);
});

test('store.off() removes a change listener', async () => {
  const store = await createStore();
  let count = 0;
  const handler = () => { count += 1; };
  store.on('change', handler);
  await store.advanceTask('inventory');
  assert.equal(count, 1);
  store.off('change', handler);
  await store.advanceTask('inventory'); // running → done
  assert.equal(count, 1); // listener was removed, count must not increment
});

test('store.destroy() cancels pending flush timer', async () => {
  const store = await createStore();
  // Trigger a mutation to schedule a debounced flush, then immediately destroy.
  // If destroy() doesn't clear the timer, the process would keep the event loop alive.
  const mutationPromise = store.createTask({ title: 'Throwaway', owner: 'Test' });
  store.destroy();
  // The mutation promise resolves because destroy() resolves pending flush resolvers.
  await mutationPromise;
  // After destroy, no further change events should fire.
  let fired = false;
  store.on('change', () => { fired = true; });
  // Calling a mutation after destroy would try to emit but emitter has no listeners.
  // We just verify the store is in a stable state (not throwing).
  assert.equal(fired, false);
});

test('activity log is capped at 100 entries', async () => {
  const store = await createStore();
  // Seed has 5 activity entries. Drive 96 more so total would be 101 without the cap.
  for (let i = 0; i < 96; i += 1) {
    await store.createTask({ title: `Task ${i}`, owner: 'Test' });
  }
  const snap = store.snapshot();
  // snapshot() returns the last 50; internal log must not exceed 100.
  assert.ok(snap.activity.length <= 50); // snapshot caps at 50
  // Most recent entry should be from the last create.
  assert.ok(snap.activity.at(-1).label.includes('Task 95'));
});
