---
"@tatara/cli": patch
"create-tatara": patch
---

Fix `tatara routes` to include better-auth endpoints. The command now fetches the OpenAPI spec from `/openapi.json` instead of calling `getOpenAPI31Document` directly, ensuring routes added via async extend callbacks are included. Also improves guard labeling for API-key security schemes.
