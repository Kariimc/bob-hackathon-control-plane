import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Seed — generic mock data only, no private values
// ---------------------------------------------------------------------------

const SEED = Object.freeze({
  project: Object.freeze({
    name: 'Demo control plane',
    mode: 'Local mock',
    baseline: 'Pre-existing',
  }),
  services: Object.freeze([
    Object.freeze({ id: 'api',      name: 'Local API',        status: 'healthy', detail: 'Loopback only' }),
    Object.freeze({ id: 'queue',    name: 'Task queue',       status: 'healthy', detail: 'In memory'    }),
    Object.freeze({ id: 'evidence', name: 'Evidence checks',  status: 'ready',   detail: 'Tests and scan' }),
  ]),
  tasks: Object.freeze([
    Object.freeze({ id: 'inventory',  title: 'Audit mock data inventory',     owner: 'Builder',   status: 'queued'  }),
    Object.freeze({ id: 'policy',     title: 'Run policy compliance checks',  owner: 'Reviewer',  status: 'running' }),
    Object.freeze({ id: 'preview',    title: 'Confirm local preview build',   owner: 'Builder',   status: 'done'    }),
    Object.freeze({ id: 'scan',       title: 'Privacy scan on git history',   owner: 'Security',  status: 'blocked', reason: 'Awaiting reviewer sign-off' }),
    Object.freeze({ id: 'deploy-dry', title: 'Dry-run deployment pipeline',   owner: 'Ops',       status: 'failed',  reason: 'Port conflict on 8788'      }),
  ]),
});

// ---------------------------------------------------------------------------
// Status model
// ---------------------------------------------------------------------------

export const STATUSES = Object.freeze(['queued', 'running', 'blocked', 'done', 'failed']);
const ADVANCE_MAP = Object.freeze({ queued: 'running', running: 'done' });
const MAX_TASKS = 200;

// ---------------------------------------------------------------------------
// Activity log helpers
// ---------------------------------------------------------------------------

const MAX_LOG = 100;

function logEntry(counter, label, tone = 'neutral') {
  return Object.freeze({ id: counter.next++, label, tone, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function serialise(tasks, activity) {
  return JSON.stringify({ tasks, activity, savedAt: Date.now() }, null, 2);
}

async function persist(path, tasks, activity) {
  if (!path) return;
  // Atomic write: write to a temp file first, then rename to avoid partial writes.
  const tmp = `${path}.tmp`;
  await writeFile(tmp, serialise(tasks, activity), 'utf8');
  await rename(tmp, path);
}

async function hydrate(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.tasks) || !Array.isArray(data.activity)) return null;
    return data;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a task store.
 *
 * @param {{ path?: string }} options
 *   path — optional file path for persistence. Omit (or pass null) for a
 *          pure in-memory store (used by tests).
 * @returns {Promise<Store>}
 */
export async function createStore({ path = null } = {}) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(64);

  // Per-store ID counter — isolated, no global mutable state.
  const counter = { next: 1 };

  // Hydrate from disk, fall back to seed.
  const saved = await hydrate(path);

  /** @type {Array<{id:string,title:string,owner:string,status:string,reason?:string}>} */
  const tasks = saved
    ? saved.tasks.map((t) => ({ ...t }))
    : SEED.tasks.map((t) => ({ ...t }));

  /** @type {Array<{id:number,label:string,tone:string,ts:number}>} */
  const activity = saved
    ? saved.activity.map((a) => ({ ...a }))
    : [
        logEntry(counter, 'Baseline loaded', 'neutral'),
        logEntry(counter, 'Privacy boundary active', 'good'),
        logEntry(counter, 'External connections disabled', 'good'),
        logEntry(counter, 'Task "Privacy scan on git history" blocked: Awaiting reviewer sign-off', 'warn'),
        logEntry(counter, 'Task "Dry-run deployment pipeline" failed: Port conflict on 8788', 'bad'),
      ];

  let revision = 1;

  // Sync the per-store counter so new entries don't collide with hydrated ones.
  if (activity.length > 0) {
    counter.next = activity.reduce((max, a) => (a.id > max ? a.id : max), 0) + 1;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  function log(label, tone = 'neutral') {
    const entry = logEntry(counter, label, tone);
    activity.push(entry);
    if (activity.length > MAX_LOG) activity.splice(0, activity.length - MAX_LOG);
    return entry;
  }

  function bump() {
    revision += 1;
  }

  // Debounced flush — coalesces rapid mutations into one disk write (50ms window).
  let _flushTimer = null;
  /** @type {Array<() => void>} */
  let _flushResolvers = [];

  function flush() {
    return new Promise((resolve) => {
      _flushResolvers.push(resolve);
      if (_flushTimer) return; // already scheduled
      _flushTimer = setTimeout(async () => {
        _flushTimer = null;
        const resolvers = _flushResolvers.splice(0);
        try {
          await persist(path, tasks.map((t) => ({ ...t })), activity.map((a) => ({ ...a })));
        } catch (err) {
          process.stderr.write(`[store] persist failed: ${err?.message ?? err}\n`);
        }
        for (const r of resolvers) r();
      }, 50);
    });
  }

  function emit() {
    emitter.emit('change');
  }

  async function mutate(fn) {
    fn();
    bump();
    emit();
    await flush();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  const store = {
    /** Subscribe to store changes (fired on every mutation). */
    on(event, handler) { emitter.on(event, handler); },
    off(event, handler) { emitter.off(event, handler); },

    /** Full dashboard snapshot — safe to serialise directly as API response. */
    snapshot() {
      return {
        ...SEED,
        tasks: tasks.map((t) => ({ ...t })),
        activity: activity.slice(-50).map((a) => ({ ...a })),
        revision,
      };
    },

    // -----------------------------------------------------------------------
    // Task mutations
    // -----------------------------------------------------------------------

    /**
     * Advance a task: queued→running, running→done.
     * Returns the updated task, or 'not_found', or 'wrong_state'.
     */
    async advanceTask(id) {
      const task = tasks.find((t) => t.id === id);
      if (!task) return 'not_found';
      const next = ADVANCE_MAP[task.status];
      if (!next) return 'wrong_state'; // done/blocked/failed — cannot advance
      await mutate(() => {
        task.status = next;
        log(`Task "${task.title}" advanced to ${next}`, 'good');
      });
      return { ...task, revision };
    },

    /** Block a task with a reason. */
    async blockTask(id, reason = '') {
      const task = tasks.find((t) => t.id === id);
      if (!task) return null;
      await mutate(() => {
        task.status = 'blocked';
        if (reason) { task.reason = reason; } else { delete task.reason; }
        log(`Task "${task.title}" blocked${reason ? `: ${reason}` : ''}`, 'warn');
      });
      return { ...task, revision };
    },

    /** Mark a task failed with a reason. */
    async failTask(id, reason = '') {
      const task = tasks.find((t) => t.id === id);
      if (!task) return null;
      await mutate(() => {
        task.status = 'failed';
        if (reason) { task.reason = reason; } else { delete task.reason; }
        log(`Task "${task.title}" failed${reason ? `: ${reason}` : ''}`, 'bad');
      });
      return { ...task, revision };
    },

    /** Reset a task back to queued. */
    async resetTask(id) {
      const task = tasks.find((t) => t.id === id);
      if (!task) return null;
      await mutate(() => {
        task.status = 'queued';
        delete task.reason;
        log(`Task "${task.title}" reset to queued`, 'neutral');
      });
      return { ...task, revision };
    },

    /**
     * Create a new task. Returns the created task, or 'limit_reached' if at cap.
     * @param {{ title: string, owner: string }} fields
     */
    async createTask({ title, owner }) {
      if (tasks.length >= MAX_TASKS) return 'limit_reached';
      const id = `task-${Date.now()}-${randomBytes(4).toString('hex')}`;
      const task = { id, title, owner, status: 'queued' };
      await mutate(() => {
        tasks.push(task);
        log(`Task "${title}" created`, 'good');
      });
      return { ...task, revision };
    },

    /** Delete a task by id. Returns true if removed. */
    async deleteTask(id) {
      const index = tasks.findIndex((t) => t.id === id);
      if (index === -1) return false;
      const title = tasks[index].title;
      await mutate(() => {
        tasks.splice(index, 1);
        log(`Task "${title}" deleted`, 'neutral');
      });
      return true;
    },

    /** Current task count by status — used by metrics. */
    statusCounts() {
      const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
      return counts;
    },

    /** Expose current revision (used by metrics). */
    get revision() { return revision; },

    /**
     * Cancel the debounce timer and resolve any pending flush promises.
     * Call from tests and graceful shutdown to avoid dangling timers.
     */
    destroy() {
      if (_flushTimer) {
        clearTimeout(_flushTimer);
        _flushTimer = null;
        for (const r of _flushResolvers.splice(0)) r();
      }
      emitter.removeAllListeners();
    },
  };

  return store;
}
