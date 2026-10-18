# Bob Hackathon Control Plane

A public-safe, loopback-only control-plane dashboard built with IBM Bob.
Runs entirely on the local machine, uses generic mock data, makes no outbound
calls, and needs no package installation. The server uses the Node.js standard
library; the Agent Office bundles Three.js r128 locally under its MIT license
(see `THIRD_PARTY_NOTICES.md`).

## What is included

- A live-updating browser dashboard with pipeline progress, mock service health,
  task workflow, and activity log.
- A live **isometric 3D Agent Office** (`/office`) — every task is a character at a
  desk, animated by status in real time via the same SSE stream.
- A loopback-only JSON API with 9 routes covering task lifecycle, SSE push, and
  operational metrics.
- An in-memory task store with optional file persistence across restarts.
- Server-Sent Events push task changes to the dashboard and office; metrics refresh every ten seconds.
- Node.js tests (77) covering all routes, store behaviour, router, and validation.
- A deterministic repository privacy scan.
- Submission tracking for the IBM Bob event.

## Requirements

- Node.js 22 or newer.
- IBM Bob IDE for hackathon implementation work.
- No dependency installation is needed.

## Run locally

```text
npm start
```

Open `http://127.0.0.1:8787` in a browser.

To use another local port, set `APP_PORT` in the process environment. The
server still binds only to `127.0.0.1`.

### Persistence

By default the task store is in-memory and resets on restart. To persist state
across restarts, set `STORE_PATH` to a writable file path:

```text
STORE_PATH=./store.json npm start
```

The file is created on the first mutation and is plain JSON. Delete it to reset
to the seed state.

## Verify

```text
npm test
npm run scan
```

The test suite checks all API routes, loopback binding, security headers, static
files, task-state changes, store isolation, persistence, the Router class, body
validation, and SSE push. The scanner checks this repository only and does not
inspect the machine or any folder outside this project.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Dashboard |
| `GET` | `/office` | Live isometric 3D Agent Office |
| `GET` | `/api/health` | Loopback boundary and service identity |
| `GET` | `/api/snapshot` | Full mock dashboard state |
| `GET` | `/api/metrics` | Uptime, request counts, task status counts, SSE connections |
| `GET` | `/api/stream` | Server-Sent Events — live snapshot push on every mutation |
| `POST` | `/api/tasks` | Create a new task `{ title, owner }` |
| `POST` | `/api/tasks/:id/advance` | Advance: queued→running→done |
| `POST` | `/api/tasks/:id/block` | Mark blocked, optional `{ reason }` body |
| `POST` | `/api/tasks/:id/fail` | Mark failed, optional `{ reason }` body |
| `POST` | `/api/tasks/:id/reset` | Reset any status back to queued |
| `DELETE` | `/api/tasks/:id` | Remove a task |

All routes return JSON. Unknown routes return `404`. Body validation errors
return `400` with a descriptive message. The `/advance` route rejects any
request body with `400`.

## Project structure

```
server.mjs          — HTTP server, router wiring, SSE, metrics
lib/
  router.mjs        — Method+regex router with async error forwarding
  store.mjs         — Task store: in-memory or file-persisted, EventEmitter
  validate.mjs      — Body parser and field validator
public/
  index.html        — Dashboard HTML
  app.js            — Dashboard client: SSE, rendering, task mutations
  styles.css        — Dark-mode styles
test/               — 77 Node.js tests across 7 test files
tools/
  privacy-scan.mjs  — Deterministic repository privacy scanner
```

## Event work

Use `HACKATHON.md` as the source of truth for the project details, improvement
log, proof, and submission checklist. Store Bob task-summary screenshots under
`bob_sessions/`.

This repository has not been published, pushed, or deployed by the baseline
creation process.
