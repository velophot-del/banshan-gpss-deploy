# SDD ledger — plan: docs/superpowers/plans/2026-10-07-teaching-case-library.md

## Pre-flight

- Task 1 produces additive MySQL case tables, roles and private storage; Tasks 2–4 consume them through authenticated APIs. Interface is consistent with the approved spec.
- Task 2 produces separate public/admin/teacher APIs and role claims; Tasks 3–4 consume those endpoints and types. Interface is consistent with the approved spec.
- Ruling: no Git worktree was created because the package has no local `.git`, while Git resolves to `/Users/tangwang/.git`; worktree operations would modify the unrelated user-home repository and conflict with the user's instruction not to initialize a repository. Proceed only within the explicitly writable deployment package.

## Tasks

- Task 1: implemented (additive schema, administrator roles, case-code sequence, private volume, non-resetting seed)
- Task 2: implemented (public/admin/teacher APIs, publication policy, role checks, private attachment routes, use records)
- Task 3: implemented (admin case/version/review workflow, attachment upload, featured state, teacher accounts, use-record list)
- Task 4: implemented (public discovery/detail, teacher login and directory, protected guide/asset links, use registration)
- Task 5: documentation and builds complete; live DB/API/browser/deployment checks remain unrun

## Verification

- Server `npm run build`: passed.
- Server `npm test`: 4 policy tests passed.
- Client `npm run build`: passed; Vite reports existing large-chunk advisory for the bundled Markdown editor/Element Plus dependency graph.
- No dependencies installed, database initialized/migrated, content seeded, or production deployment executed.
- Live MySQL migration/idempotence, API role matrix, actual private-file reads, and browser desktop/mobile walkthrough remain unverified because no isolated DB fixture/service was used.
- The provided teaching-case workbook has no submitted case rows; no case content was imported or fabricated.
