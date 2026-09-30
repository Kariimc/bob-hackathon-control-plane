const seed = Object.freeze({
  project: {
    name: 'Demo control plane',
    mode: 'Local mock',
    baseline: 'Pre-existing',
  },
  services: [
    { id: 'api', name: 'Local API', status: 'healthy', detail: 'Loopback only' },
    { id: 'queue', name: 'Task queue', status: 'healthy', detail: 'In memory' },
    { id: 'evidence', name: 'Evidence checks', status: 'ready', detail: 'Tests and scan' },
  ],
  tasks: [
    { id: 'inventory', title: 'Review mock inventory', owner: 'Builder', status: 'queued' },
    { id: 'policy', title: 'Run policy checks', owner: 'Reviewer', status: 'running' },
    { id: 'preview', title: 'Confirm local preview', owner: 'Builder', status: 'done' },
  ],
  activity: [
    { id: 1, label: 'Baseline loaded', tone: 'neutral' },
    { id: 2, label: 'Privacy boundary active', tone: 'good' },
    { id: 3, label: 'External connections disabled', tone: 'good' },
  ],
});

const order = ['queued', 'running', 'done'];

export function createStore() {
  const tasks = seed.tasks.map((task) => ({ ...task }));
  let revision = 1;

  return {
    snapshot() {
      return {
        ...seed,
        tasks: tasks.map((task) => ({ ...task })),
        revision,
      };
    },

    advanceTask(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) return null;
      const current = order.indexOf(task.status);
      task.status = order[(current + 1) % order.length];
      revision += 1;
      return { ...task, revision };
    },
  };
}
