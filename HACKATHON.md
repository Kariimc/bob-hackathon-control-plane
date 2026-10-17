# IBM Bob Hackathon Record

## Project details

**Working title:** Bob Hackathon Control Plane  
**Selected track:** Experienced Developers — Modernize What Matters
**Category:** Local developer operations dashboard  
**Problem:** Small teams need one clear view of work, health, and evidence
without exposing private machine data.  
**Baseline:** A dependency-free local dashboard and mock API existed before
hackathon feature work. The initial commit records that pre-existing baseline.  
**Hackathon goal:** Use IBM Bob to add clearly measured improvements without
turning private workstation state into submission data.

**Project description (47 words; limit 100):** Bob Hackathon Control Plane is a
privacy-first local dashboard for developer work, service health, and test
evidence. The clean-room baseline uses only generic in-memory data and no remote
services. During the event, IBM Bob will modernize this baseline through
measured features, tests, documentation, and reviewable task evidence.

**Technology:** IBM Bob IDE, Node.js 22 standard library, vanilla HTML, CSS and
JavaScript, Node test runner, Git, and GitHub.

## Current event facts

- Build period: September 28 through October 18, 2026.
- Submission deadline: October 18, 2026 at 11:59 PM ET.
- Eligibility: age 18 or older and residing in the United States; teams may
  contain one to five people and may submit one project.
- Existing projects are allowed, but judging covers only meaningful work made
  during the build period and declared in the submission.
- IBM Bob IDE is required. Every team member must save Bob task-summary
  screenshots and exported task-history Markdown reports in the final repository.

## Judging weights

- IBM Bob usage and depth of adoption: 30%.
- Innovation and use-case relevance: 30%.
- Functionality and technical execution: 30%.
- Presentation and clarity: 10%.

## Eligibility boundary

Only changes made in IBM Bob from September 28 through October 18, 2026 count
as hackathon improvements. The initial baseline commit is not claimed as event
work. Each improvement must have a later commit, test proof, and a Bob task
summary screenshot and exported task-history report.

## Improvement log

| Date | Bob task | Improvement | Proof | Bob evidence |
|---|---|---|---|---|
| 2026-09-30 | Modernize codebase | `styles.css` font-weight fix; `server.mjs` error logging + graceful shutdown; `app.js` stuck-disabled button fix | `npm test` 13/13 pass | `bob_sessions/2026-09-30-task-01-modernize.md` · `2026-09-30-task-01-modernize-snap.png` ✓ |
| 2026-09-30 | Software factory build | Router class; persistent store (EventEmitter, 5-status pipeline, activity log, file persistence); body parser + validator; 9-route server (SSE, metrics, create/block/fail/reset/delete); dashboard overhaul (pipeline rail, task creation form, SSE badge, toast stack, timestamps) | `npm test` 50/50 pass | `bob_sessions/2026-09-30-task-02-factory.md` · `2026-09-30-task-02-factory-snap.png` ✓ |
| 2026-09-30 | Visual quality system | `visual-quality-gate` 5-phase AAA skill; `taste-library` skill + 16-entry seed corpus; `visual.md` rules (5 non-negotiable gates); `/score` command; Visual Director mode | All `.bob` files validated; `npm test` 50/50 pass | `bob_sessions/2026-09-30-task-03-visual.md` · `2026-09-30-task-03-visual-snap.png` ✓ |
| 2026-09-30 | 3D workflow | `3d-workflow` skill (8-phase production spec: concept, topology, UV, PBR, lighting, LOD, code arch, export); `validate-mesh.mjs` OBJ validation script; `shaders.md` 6-shader library; `rig.md` canonical 3-point rig (bpy + Three.js); 4 new 3D taste library entries; updated domain stacks | `npm test` 50/50 pass | `bob_sessions/2026-09-30-task-04-3d.md` · `2026-09-30-task-04-3d-snap.png` ✓ |
| 2026-09-30 | Bug fixes | Async handler leak in Router (unhandled Promise rejections); `innerHTML` XSS pattern in pipeline rail; `STORE_PATH` env variable wired; timestamp refresh interval; flush debounce (50ms); SSE reconnection backoff (5 retries, exponential); README and HACKATHON.md updated | `npm test` 52/52 pass | `bob_sessions/2026-09-30-task-05-bugfix.md` · `2026-09-30-task-05-bugfix-snap.png` ✓ |
| 2026-09-30 | Full system modernization | Agent Office page (pure Canvas 2D isometric renderer — no CDN, fully offline); `store.mjs` hardening (`flush()` error safety, `advanceTask` sentinels `not_found`/`wrong_state`, `createTask` sentinel `limit_reached`, `MAX_TASKS=200` cap); server hardening (`server._store?.destroy()` shutdown fix, 404/409/422 response codes); `sendStatic` dead-code cleanup (removed `officeSecurityHeaders` branch, strict CSP everywhere); test suite updated (CDN CSP assertions replaced with strict CSP assertions) | `npm test` 77/77 pass, `npm run scan` PASS | `bob_sessions/2026-09-30-task-06-modernization.md` · `2026-09-30-modernization-snap.png` ✓ |

Do not count cosmetic wording, generated boilerplate, or changes made outside
IBM Bob as event improvements.

## Submission checklist

- [ ] GitHub repository created from this safe copy.
- [x] README includes setup and testing instructions.
- [x] Project problem, baseline, and event boundary documented.
- [x] Improvements made in IBM Bob are listed with proof.
- [x] Task history Markdown reports saved in `bob_sessions/` (6 files).
- [x] Bob session snaps saved in `bob_sessions/` (6 of 6 done).
- [ ] Pitch exported as a PDF.
- [ ] Pitch covers the team and project, the solution summary against the
      judging criteria, key learnings, improvement opportunities, and roadmap.
- [ ] Public YouTube demo is three minutes or less.
- [ ] Live demo link is available.
- [ ] Every team member's Bob task-summary screenshots are saved in `bob_sessions/`.
- [ ] Every team member's exported Bob task-history `.md` reports are saved in
      `bob_sessions/`.
- [ ] `npm test` passes on the final commit.
- [ ] `npm run scan` passes on the final commit.
- [ ] Final repository reviewed before publication.

## Demo outline

1. State the problem and the public-safe boundary.
2. Show the pre-existing baseline briefly.
3. Show each IBM Bob improvement and its task summary.
4. Run the tests and privacy scan.
5. Show the live demo and close with the measured result.

Keep the recorded demo at or under three minutes. The pitch PDF, YouTube upload,
live-demo publication, and public repository are outside the baseline and remain
pending until explicitly approved.
