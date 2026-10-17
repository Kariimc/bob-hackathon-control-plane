# Bob Task: Modernize codebase

**Date:** 2026-09-30
**Repository:** bob-hackathon-control-plane
**Tool:** IBM Bob IDE — Agent mode
**Result:** npm test 13/13 pass

## What Bob built

- `public/styles.css` — fixed invalid `font-weight: 750` (not a valid CSS value) to `font-weight: 700`
- `server.mjs` — added structured error logging to stderr; added graceful shutdown on SIGTERM/SIGINT
- `public/app.js` — fixed a stuck-disabled submit button that never re-enabled after a failed task creation request

## Files changed

- `public/styles.css`
- `server.mjs`
- `public/app.js`

## Test proof

```
npm test — 13/13 pass
npm run scan — PASS
```

## Notes

This was the first Bob task on the baseline. The three fixes were all bugs present in the
pre-existing code. No new features were added; the goal was to make the existing behaviour
correct and robust before building on top of it.
