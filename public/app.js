// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const servicesRoot  = document.querySelector('#services');
const tasksRoot     = document.querySelector('#tasks');
const activityRoot  = document.querySelector('#activity');
const pipelineRail  = document.querySelector('#pipeline-rail');
const revisionEl    = document.querySelector('#revision');
const noticesEl     = document.querySelector('#notices');
const metricsBar    = document.querySelector('#metrics-bar');
const refreshButton = document.querySelector('#refresh');
const streamStatus  = document.querySelector('#stream-status');
const addToggle     = document.querySelector('#add-task-toggle');
const newTaskForm   = document.querySelector('#new-task-form');
const newTaskTitle  = document.querySelector('#new-task-title');
const newTaskOwner  = document.querySelector('#new-task-owner');
const cancelBtn     = document.querySelector('#new-task-cancel');
const reasonDialog  = document.querySelector('#reason-dialog');
const reasonDesc    = document.querySelector('#reason-dialog-desc');
const reasonInput   = document.querySelector('#reason-input');
const reasonConfirm = document.querySelector('#reason-confirm');
const reasonCancel  = document.querySelector('#reason-cancel');

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------

function toast(message, type = 'info') {
  const el = document.createElement('p');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  noticesEl.prepend(el);
  setTimeout(() => el.remove(), 5000);
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function text(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}

// ---------------------------------------------------------------------------
// Metrics bar
// ---------------------------------------------------------------------------

async function refreshMetrics() {
  try {
    const res = await fetch('/api/metrics', { cache: 'no-store' });
    if (!res.ok) return;
    const m = await res.json();
    const items = [
      { label: 'Uptime',    value: formatUptime(m.uptime_s) },
      { label: 'Requests',  value: m.requests_total },
      { label: 'SSE',       value: `${m.sse_connections} connected` },
      { label: 'Revision',  value: m.store_revision },
    ];
    metricsBar.replaceChildren(...items.map(({ label, value }) => {
      const stat = document.createElement('div');
      stat.className = 'metric-stat';
      stat.append(text('span', label, 'metric-label'), text('span', value, 'metric-value'));
      return stat;
    }));
  } catch { /* non-critical */ }
}

function formatUptime(seconds) {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// DOM builders
// ---------------------------------------------------------------------------

function renderPipeline(tasks) {
  const counts = { queued: 0, running: 0, blocked: 0, done: 0, failed: 0 };
  for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const total = tasks.length || 1;
  const stages = [
    { key: 'queued',  label: 'Queued'  },
    { key: 'running', label: 'Running' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'done',    label: 'Done'    },
    { key: 'failed',  label: 'Failed'  },
  ];
  pipelineRail.replaceChildren(...stages.map(({ key, label }) => {
    const pct = Math.round((counts[key] / total) * 100);
    const seg = document.createElement('div');
    seg.className = `pipeline-seg pipeline-seg--${key}`;
    const labelEl = document.createElement('span');
    labelEl.className = 'pipeline-seg__label';
    labelEl.textContent = label;
    const barOuter = document.createElement('span');
    barOuter.className = 'pipeline-seg__bar';
    const barInner = document.createElement('span');
    barInner.style.width = `${pct}%`;
    barOuter.append(barInner);
    const countEl = document.createElement('span');
    countEl.className = 'pipeline-seg__count';
    countEl.textContent = counts[key];
    seg.append(labelEl, barOuter, countEl);
    return seg;
  }));
}

function renderServices(services) {
  servicesRoot.replaceChildren(...services.map((service) => {
    const card = document.createElement('article');
    card.className = 'service-card';
    const dot = document.createElement('span');
    dot.className = `status-dot ${service.status}`;
    dot.setAttribute('aria-label', service.status);
    card.append(dot, text('h3', service.name), text('p', service.detail));
    return card;
  }));
}

// Actions available per status
const ACTION_MAP = {
  queued:  [{ label: 'Advance', action: 'advance' }, { label: 'Block', action: 'block', secondary: true }, { label: 'Fail', action: 'fail', secondary: true }],
  running: [{ label: 'Advance', action: 'advance' }, { label: 'Block', action: 'block', secondary: true }, { label: 'Fail', action: 'fail', secondary: true }],
  blocked: [{ label: 'Reset',   action: 'reset'   }, { label: 'Fail',  action: 'fail',  secondary: true }],
  done:    [{ label: 'Reset',   action: 'reset'   }],
  failed:  [{ label: 'Reset',   action: 'reset'   }],
};

function renderTasks(tasks) {
  if (tasks.length === 0) {
    tasksRoot.replaceChildren((() => {
      const empty = document.createElement('div');
      empty.className = 'task-empty';
      empty.append(
        text('p', 'No tasks yet.', 'task-empty__title'),
        text('p', 'Use "+ New task" to add one.', 'task-empty__hint'),
      );
      return empty;
    })());
    return;
  }

  tasksRoot.replaceChildren(...tasks.map((task) => {
    const row = document.createElement('article');
    row.className = `task-row task-row--${task.status}`;
    row.dataset.taskId = task.id;

    const copy = document.createElement('div');
    copy.className = 'task-copy';
    copy.append(text('h3', task.title));
    const meta = document.createElement('p');
    meta.className = 'task-meta';
    meta.textContent = task.owner;
    if (task.reason) {
      const reason = document.createElement('span');
      reason.className = 'task-reason';
      reason.textContent = ` — ${task.reason}`;
      meta.append(reason);
    }
    copy.append(meta);

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(text('span', task.status, `pill pill--${task.status}`));

    const taskActions = ACTION_MAP[task.status] ?? [{ label: 'Reset', action: 'reset' }];
    for (const { label, action, secondary } of taskActions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      if (secondary) btn.className = 'btn-secondary btn-sm';
      btn.dataset.taskId = task.id;
      btn.dataset.action = action;
      btn.setAttribute('aria-label', `${label} ${task.title}`);
      actions.append(btn);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-icon btn-delete';
    delBtn.textContent = '×';
    delBtn.dataset.taskId = task.id;
    delBtn.dataset.action = 'delete';
    delBtn.setAttribute('aria-label', `Delete ${task.title}`);
    actions.append(delBtn);

    row.append(copy, actions);
    return row;
  }));
}

function renderActivity(activity) {
  activityRoot.replaceChildren(...[...activity].reverse().map((item) => {
    const li = document.createElement('li');
    li.className = item.tone ?? 'neutral';
    const label = document.createElement('span');
    label.textContent = item.label;
    const ts = item.ts ? document.createElement('time') : null;
    if (ts) {
      ts.className = 'activity-ts';
      ts.dateTime = new Date(item.ts).toISOString();
      ts.textContent = relativeTime(item.ts);
    }
    li.append(label);
    if (ts) li.append(ts);
    return li;
  }));
}

// ---------------------------------------------------------------------------
// Snapshot render
// ---------------------------------------------------------------------------

function applySnapshot(snapshot) {
  renderPipeline(snapshot.tasks);
  renderServices(snapshot.services);
  renderTasks(snapshot.tasks);
  renderActivity(snapshot.activity);
  revisionEl.textContent = `Revision ${snapshot.revision}`;
}

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function loadSnapshot(message = '') {
  refreshButton.disabled = true;
  try {
    const response = await fetch('/api/snapshot', { cache: 'no-store' });
    if (!response.ok) throw new Error('Snapshot unavailable');
    applySnapshot(await response.json());
    if (message) toast(message, 'info');
  } catch {
    toast('The local snapshot could not be loaded.', 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Server-Sent Events — live push
// ---------------------------------------------------------------------------

function connectStream() {
  const MAX_RETRIES = 5;
  let retries = 0;

  function connect() {
    const es = new EventSource('/api/stream');
    streamStatus.textContent = '⬤ Connecting';
    streamStatus.className = 'stream-badge stream-badge--connecting';

    es.addEventListener('snapshot', (event) => {
      try {
        applySnapshot(JSON.parse(event.data));
      } catch { /* ignore malformed events */ }
    });

    es.onopen = () => {
      retries = 0;
      streamStatus.textContent = '⬤ Live';
      streamStatus.className = 'stream-badge stream-badge--live';
    };

    es.onerror = () => {
      es.close();
      if (retries >= MAX_RETRIES) {
        streamStatus.textContent = '⬤ Offline';
        streamStatus.className = 'stream-badge stream-badge--error';
        return;
      }
      const delay = Math.min(1000 * (2 ** retries), 16_000);
      retries += 1;
      streamStatus.textContent = `⬤ Retry ${retries}/${MAX_RETRIES}`;
      streamStatus.className = 'stream-badge stream-badge--connecting';
      setTimeout(connect, delay);
    };
  }

  connect();
}

// ---------------------------------------------------------------------------
// Task mutations
// ---------------------------------------------------------------------------

async function mutateTask(taskId, action, payload = null) {
  const method = action === 'delete' ? 'DELETE' : 'POST';
  const url = action === 'delete'
    ? `/api/tasks/${taskId}`
    : `/api/tasks/${taskId}/${action}`;
  const options = { method };
  if (payload) {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `${action} failed (${response.status})`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Reason dialog (block / fail)
// ---------------------------------------------------------------------------

/**
 * Opens the reason dialog and resolves with the entered reason string,
 * or null if the user cancelled.
 */
function promptReason(verb, taskTitle) {
  return new Promise((resolve) => {
    reasonDesc.textContent = `${verb} task: "${taskTitle}"`;
    reasonInput.value = '';
    reasonConfirm.textContent = verb;
    reasonDialog.showModal();

    function onConfirm() {
      cleanup();
      resolve(reasonInput.value.trim());
    }
    function onCancel() {
      cleanup();
      resolve(null);
    }
    function onClose() {
      cleanup();
      resolve(null);
    }
    function cleanup() {
      reasonConfirm.removeEventListener('click', onConfirm);
      reasonCancel.removeEventListener('click', onCancel);
      reasonDialog.removeEventListener('close', onClose);
    }

    reasonConfirm.addEventListener('click', onConfirm);
    reasonCancel.addEventListener('click', onCancel);
    reasonDialog.addEventListener('close', onClose);
  });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// Refresh button
refreshButton.addEventListener('click', () => loadSnapshot('Snapshot refreshed.'));

// Keyboard shortcut: R to refresh (when no input focused)
document.addEventListener('keydown', (event) => {
  if (event.key === 'r' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    loadSnapshot('Snapshot refreshed.');
  }
});

// Add task toggle
addToggle.addEventListener('click', () => {
  const hidden = newTaskForm.hidden;
  newTaskForm.hidden = !hidden;
  addToggle.textContent = hidden ? '✕ Close' : '+ New task';
  if (!newTaskForm.hidden) newTaskTitle.focus();
});

cancelBtn.addEventListener('click', () => {
  newTaskForm.hidden = true;
  addToggle.textContent = '+ New task';
  newTaskForm.reset();
});

// New task form submit
newTaskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = newTaskTitle.value.trim();
  const owner = newTaskOwner.value.trim();
  if (!title || !owner) return;
  const submitBtn = newTaskForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, owner }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Create failed');
    newTaskForm.reset();
    newTaskForm.hidden = true;
    addToggle.textContent = '+ New task';
    toast(`Task "${title}" created.`, 'info');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// Task actions — delegated to the task list
tasksRoot.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-task-id][data-action]');
  if (!btn) return;

  const { taskId, action } = btn.dataset;

  // Block and fail require a reason prompt before the network call.
  if (action === 'block' || action === 'fail') {
    // Find the task title for the dialog without re-fetching.
    const titleEl = btn.closest('[data-task-id]')?.querySelector('h3');
    const taskTitle = titleEl?.textContent ?? taskId;
    const verb = action === 'block' ? 'Block' : 'Fail';
    const reason = await promptReason(verb, taskTitle);
    if (reason === null) return; // user cancelled
    btn.disabled = true;
    try {
      await mutateTask(taskId, action, reason ? { reason } : null);
      const PAST = { block: 'blocked', fail: 'failed' };
      toast(`Task ${PAST[action]}.`, 'info');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      if (btn.isConnected) btn.disabled = false;
    }
    return;
  }

  btn.disabled = true;
  try {
    await mutateTask(taskId, action);
    const PAST = { advance: 'advanced', reset: 'reset', delete: 'removed' };
    toast(`Task ${PAST[action] ?? action}.`, 'info');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
});

// Close dialog on backdrop click
reasonDialog.addEventListener('click', (event) => {
  if (event.target === reasonDialog) reasonDialog.close();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

connectStream();
loadSnapshot();
refreshMetrics();

// Keep metrics fresh every 10s and timestamps fresh every 30s.
setInterval(refreshMetrics, 10_000);
setInterval(() => {
  for (const el of activityRoot.querySelectorAll('time[datetime]')) {
    const ts = new Date(el.dateTime).getTime();
    if (!Number.isNaN(ts)) el.textContent = relativeTime(ts);
  }
}, 30_000);
