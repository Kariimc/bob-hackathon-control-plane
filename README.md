# Bob Hackathon Control Plane

A small, public-safe control-plane baseline for building with IBM Bob. It runs
entirely on the local machine, uses generic mock data, makes no outbound calls,
and has no third-party dependencies.

This initial commit is a pre-existing baseline. Hackathon improvements belong
in later commits and must be recorded in `HACKATHON.md` with Bob task evidence.

## What is included

- A browser dashboard with mock service health, tasks, and activity.
- A loopback-only JSON API.
- An in-memory task-state demo. Restarting resets it.
- Node.js tests and a deterministic repository privacy scan.
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

## Verify

```text
npm test
npm run scan
```

The test suite checks API behavior, loopback binding, security headers, static
files, and task-state changes. The scanner checks this repository only. It does
not inspect the machine or any folder outside this project.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Local service status |
| `GET` | `/api/snapshot` | Full mock dashboard state |
| `POST` | `/api/tasks/:id/advance` | Advance one mock task |

Unknown routes return JSON `404` responses. The task-update route rejects any
request body with a JSON `400` response.

## Event work

Use `HACKATHON.md` as the source of truth for the project details, improvement
log, proof, and submission checklist. Store Bob task-summary screenshots under
`bob_sessions/`.

This repository has not been published, pushed, or deployed by the baseline
creation process.
