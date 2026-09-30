# AGENTS.md

This repository is the public-safe baseline for an IBM Bob hackathon project.

## Working rules

1. Use the IBM Bob IDE for hackathon implementation work.
2. Keep all work inside this repository. Do not read the host machine, sibling
   folders, browser profiles, environment stores, or user configuration.
3. Use Node.js 22 or newer and the standard library only. Do not add packages.
4. Keep the server bound to `127.0.0.1`. Do not add outbound requests, remote
   analytics, telemetry, or cloud integrations.
5. Use generic mock data only. Never add private data, credentials, identifying
   paths, personal messages, or internal documents.
6. Before every commit, run `npm test` and `npm run scan`. A failing check blocks
   the commit.
7. Record only improvements built in Bob during the event in `HACKATHON.md`.
   Keep the initial commit labeled as the pre-existing baseline.
8. Save Bob task-summary screenshots in `bob_sessions/`. Do not store runtime
   output there.
9. Do not publish, push, deploy, or create a public repository without the
   project owner's explicit approval.

## Definition of done

- The browser dashboard works from the local server.
- The API tests pass.
- The privacy scanner passes.
- `HACKATHON.md` identifies the change, its Bob task, proof, and date.
- A screenshot of the Bob task summary is saved for submission evidence.
