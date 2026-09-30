const servicesRoot = document.querySelector('#services');
const tasksRoot = document.querySelector('#tasks');
const activityRoot = document.querySelector('#activity');
const revision = document.querySelector('#revision');
const notice = document.querySelector('#notice');
const refreshButton = document.querySelector('#refresh');

function text(tag, value, className) {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
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

function renderTasks(tasks) {
  tasksRoot.replaceChildren(...tasks.map((task) => {
    const row = document.createElement('article');
    row.className = 'task-row';
    const copy = document.createElement('div');
    copy.append(text('h3', task.title), text('p', task.owner));

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(text('span', task.status, `pill ${task.status}`));
    const button = text('button', 'Advance');
    button.type = 'button';
    button.dataset.taskId = task.id;
    button.setAttribute('aria-label', `Advance ${task.title}`);
    actions.append(button);
    row.append(copy, actions);
    return row;
  }));
}

function renderActivity(activity) {
  activityRoot.replaceChildren(...activity.map((item) => text('li', item.label, item.tone)));
}

async function loadSnapshot(message = '') {
  refreshButton.disabled = true;
  try {
    const response = await fetch('/api/snapshot', { cache: 'no-store' });
    if (!response.ok) throw new Error('Snapshot unavailable');
    const snapshot = await response.json();
    renderServices(snapshot.services);
    renderTasks(snapshot.tasks);
    renderActivity(snapshot.activity);
    revision.textContent = `Revision ${snapshot.revision}`;
    notice.textContent = message;
  } catch {
    notice.textContent = 'The local snapshot could not be loaded.';
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', () => loadSnapshot('Snapshot refreshed.'));

tasksRoot.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-task-id]');
  if (!button) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/tasks/${button.dataset.taskId}/advance`, { method: 'POST' });
    if (!response.ok) throw new Error('Task update failed');
    await loadSnapshot('Mock task advanced.');
  } catch {
    notice.textContent = 'The mock task could not be advanced.';
    button.disabled = false;
  }
});

loadSnapshot();
