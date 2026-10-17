# Bob Task: Full system modernization

**Date:** 2026-09-30
**Repository:** bob-hackathon-control-plane
**Tool:** IBM Bob IDE — Agent mode
**Result:** npm test 77/77 pass, npm run scan PASS

## What Bob built

### public/office.html + public/office.js — Live isometric Agent Office
- Pure Canvas 2D isometric renderer — zero external dependencies, fully offline
- Teal ambient background, warm cream/beige walls, dark hardwood floor
- Orange accent furniture matching provided reference image
- Wall decorations: whiteboard, live clock, bookshelf, glass windows, water cooler, potted plant
- Chibi Nendoroid-proportioned agent characters:
  - Oversized round head (~42% of total width)
  - Large expressive chibi eyes with specular highlight
  - Rosy blush cheeks, expressive smile/frown per status
  - Stubby legs, wide torso, IBM badge on chest
- LLM logo merch patches on every agent's shirt:
  - Builder → GitHub Copilot (visor + sparkle, navy shirt)
  - Reviewer → Claude/Anthropic (triangle mark, terracotta shirt)
  - Security → Gemini/Google (4-pointed star, Google blue shirt)
  - Ops → ChatGPT/OpenAI (bloom mark, OpenAI teal shirt)
  - Default → IBM Granite (8-bar stripe wordmark, IBM blue shirt)
- Status-driven animations: typing (running), head-shake (blocked), droop (failed), bounce (done)
- Particle burst on status change
- Hover tooltip showing task title, owner, LLM name, status, reason
- Pan + zoom camera (drag to pan, scroll to zoom)
- SSE live connection with exponential backoff reconnection
- Legend panel with both status colours and agent/LLM key

### lib/store.mjs — Hardening
- `flush()` wrapped in try/catch — a disk error no longer hangs all pending mutations
- `advanceTask()` returns string sentinels `'not_found'` / `'wrong_state'` instead of `null`
  for both error cases, allowing the server to return 404 vs 409 Conflict correctly
- `createTask()` returns sentinel `'limit_reached'` when at `MAX_TASKS = 200`

### server.mjs — Hardening
- `server._store?.destroy()` in shutdown handler — fixes `ReferenceError` on SIGTERM/SIGINT
- `POST /api/tasks/:id/advance` returns 409 Conflict on wrong state (was 500)
- `POST /api/tasks` returns 422 Unprocessable Entity when task limit is reached
- `sendStatic()` dead-code removed — `officeSecurityHeaders` branch deleted,
  all static files now correctly use the strict loopback-only CSP

### test/ — Test suite updated
- 3 broken tests that asserted `cdn.jsdelivr.net` in the CSP fixed to assert strict CSP
- 2 new tests: 409 Conflict on advance wrong-state, 422 on task limit

### public/office.html — UI retheme
- Background changed from dark `#04060c` to teal `#7ecfcc` matching office renderer
- Top bar: white frosted glass instead of dark gradient
- Tooltip: white card with dark text instead of dark card
- Legend: white pill panel with "Status" and "Agent / LLM" sections

## Files changed

- `public/office.html` (rewritten)
- `public/office.js` (rewritten — Canvas 2D renderer, chibi agents, LLM logos)
- `lib/store.mjs` (hardened)
- `server.mjs` (hardened + dead code removed)
- `test/server.test.mjs` (3 tests fixed)
- `test/api.test.mjs` (2 new tests)
- `HACKATHON.md` (improvement log updated)

## Test proof

```
npm test — 77/77 pass
npm run scan — PASS
```

## Notes

This was the capstone task. It combined a full visual redesign (matched to
provided reference images of a warm isometric office and chibi Nendoroid
characters), a store/server hardening pass, and a CSP cleanup — all validated
by the full test suite.
