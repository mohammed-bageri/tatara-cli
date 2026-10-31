---
"@tatara/cache": minor
"@tatara/cli": minor
"create-tatara": minor
---

`@tatara/cache`: one cache contract (`get/set/del/delPrefix/add/take/increment/wrap/lock`, `orgKey`/`userKey`) with memory, Redis and Postgres (unlogged table in its own schema) drivers. New `cache` add-on: `cache` from `#core/cache/index`, picked with `CACHE_DRIVER` (Redis by default, memory in tests).
