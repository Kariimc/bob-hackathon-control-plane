# Bob Task: Software factory build

**Date:** 2026-09-30
**Repository:** bob-hackathon-control-plane
**Tool:** IBM Bob IDE — Agent mode
**Result:** npm test 50/50 pass

## What Bob built

### lib/router.mjs — Router class
- Method + regex dispatch
- Async handler error forwarding to `onError`
- Supports GET, POST, DELETE with exact string or regex paths

### lib/store.mjs — Persistent task store
- EventEmitter-based change notifications
- 5-status pipeline: queued → running → done / blocked / failed
- Debounced atomic file persistence (50ms window, tmp-then-rename)
- Activity log with timestamps, capped at 100 entries
- Per-store ID counter (no global mutable state)

### lib/validate.mjs — Body parser and validator
- `readBody()` — streams request body with 64KB cap, parses JSON
- `validate()` — schema-driven field validation with `string:N` max-length support
- `ValidationError` class with correct `.name` property

### server.mjs — 9-route HTTP server
- GET /api/health, /api/snapshot, /api/metrics, /api/stream (SSE)
- POST /api/tasks (create), /api/tasks/:id/advance, /api/tasks/:id/block
- POST /api/tasks/:id/fail, /api/tasks/:id/reset
- DELETE /api/tasks/:id
- Strict loopback-only CSP on all routes
- SSE heartbeat every 15s

### public/index.html + public/app.js + public/styles.css — Dashboard overhaul
- Pipeline rail (queued → running → done status bar)
- Task creation form with owner field
- SSE live badge (⬤ Live / ⬤ Connecting)
- Toast notification stack
- Activity log with timestamps
- Metrics bar (uptime, request count, task counts)

## Files changed

- `lib/router.mjs` (new)
- `lib/store.mjs` (new)
- `lib/validate.mjs` (new)
- `server.mjs` (rewritten)
- `public/index.html` (overhauled)
- `public/app.js` (overhauled)
- `public/styles.css` (overhauled)
- `test/api.test.mjs` (new)
- `test/router.test.mjs` (new)
- `test/store.test.mjs` (new)
- `test/validate.test.mjs` (new)

## Test proof

```
npm test — 50/50 pass
npm run scan — PASS
```

## Notes

This was the largest single Bob task — it turned the minimal baseline into a
production-quality software factory: typed store, typed router, body validation,
SSE push, metrics, and a fully working dashboard. All built with Node.js 22
standard library only; zero external packages.
