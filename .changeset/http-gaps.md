---
"@tatara/http": patch
"@tatara/cli": minor
"create-tatara": minor
---

`@tatara/http`: `rateLimit` (fixed window over any counter, 429 RATE_LIMITED with Retry-After, fails open), `clientIp`/`withClientIp` (trusted proxy hops), cursor pagination (`cursorQuerySchema`, `cursorPage`, `encodeCursor`/`decodeCursor`), CORS origin patterns (`https://*.example.com`), per-path request timeouts (504 REQUEST_TIMEOUT), and `startServer({ onServer })`. Generated apps time out requests after `REQUEST_TIMEOUT_MS`, give better-auth the caller's real address (`TRUSTED_PROXY_HOPS`), and with the cache add-on get `limitRequests`. New `tatara contracts` writes each app's OpenAPI document and TypeScript types for openapi-fetch clients (`--check` for CI). Codemod 0.11.0 `http-limits`.
