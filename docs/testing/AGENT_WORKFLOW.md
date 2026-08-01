# Agentic test workflow

Catalog: [permission-gating-catalog.md](./permission-gating-catalog.md)

## Run

```bash
cd graider
npm test          # L1 then L2 (separate processes)
npm run test:l1   # pure lib modules
npm run test:api  # L2 route contracts (module mocks)
```

Uses Node’s built-in test runner via `tsx`. L2 needs `--experimental-test-module-mocks`.

## Status

L1 + L2 catalog cases are green. Remaining optional work:

- **JOIN-07** — concurrent single-use invite race (L3 / real DB)
- Broader L3 integration matrix against a test database

## Agent protocol (one module per pass)

1. Open the catalog and pick the next unchecked case.
2. Prefer extracting pure policy helpers under `lib/*-policy.ts` when a route gate is hard to unit-test.
3. Add/extend `lib/__tests__/` (L1) or `app/api/__tests__/` (L2).
4. For L2: use `installL2Mocks()` + `scriptedDb` + catalog actors before importing routes.
5. Run `npm test` and fix failures.
6. Check off case IDs in the catalog (`[x]`).
