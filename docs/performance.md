# Performance budgets

tatara must not slow apps down; Hono is fast. `pnpm bench` measures a generated app
(`--orm none --db none --auth none`) against a plain Hono app with the same route
(`bench/baseline-app`) and fails when a median is over its budget in `bench/budgets.json`.
Each measurement is the median of 5 runs, so one slow run can't fail a budget.

| Key | What | Budget |
|---|---|---|
| `requestOverheadMs` | Extra milliseconds per `GET /health` versus plain Hono: 2000 sequential keep-alive requests per run, after 200 warm-up requests | 0.1 |
| `coldBootMs` | `node dist/apps/api/server.mjs` until `/health` answers 200 | 300 |
| `corePackagesKb` | `dist/` size of `@tatara/core` + `@tatara/http` (n/a until those packages exist) | 500 |
| `sync100Ms` | `tatara sync` on an app with 100 modules (one route file and one command each) | 2000 |

Run it with `pnpm bench` (or `pnpm bench --json`). It builds and packs the CLI, generates the app
in `.e2e/bench/`, builds it, installs the baseline and measures.

## Baseline (2026-10-30, before any code moved into packages)

Measured on a developer laptop (Linux, Node 24), five `pnpm bench` runs:

| Key | Results | Budget |
|---|---|---|
| `requestOverheadMs` | 0.093, 0.096, 0.098, 0.106, 0.107 | 0.1, **at the limit**: about half the runs are over |
| `coldBootMs` | 96–98 | 300 |
| `corePackagesKb` | n/a | 500 |
| `sync100Ms` | 67–69 | 2000 |

The request overhead is the whole middleware stack `createHttpApp` adds (request id, secure
headers, CORS, body limit, language, principal, error handler). Step 2 (`@tatara/http`) is where it
is measured again.
