# Measuring tatara's cost

tatara should stay a thin layer: routes are plain Hono and nothing is wired at runtime. There
are no performance gates; `pnpm bench` is a tool to look at the numbers when you want to.

It generates an app (`--orm none --db none --auth none`), builds it, and compares it with a
plain Hono app with the same route (`bench/baseline-app`). Each number is the median of 5 runs.

| Key | What |
|---|---|
| `requestOverheadMs` | Extra milliseconds per `GET /health` versus plain Hono (2000 sequential keep-alive requests per run) |
| `coldBootMs` | `node dist/apps/api/server.mjs` until `/health` answers 200 |
| `corePackagesKb` | `dist/` size of `@tatara/core` + `@tatara/http` (n/a until both exist) |
| `sync100Ms` | `tatara sync` on an app with 100 modules |

Run `pnpm bench` (or `pnpm bench --json`).

Numbers on 2026-10-30: request overhead 0.09–0.11 ms on a laptop and 0.13 ms on GitHub's
runners; cold boot about 100 ms; `sync` on 100 modules about 70 ms.
