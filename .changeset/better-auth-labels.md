---
"@tatara/cli": patch
"create-tatara": patch
---

Label better-auth routes as "better-auth" in `tatara routes`. Routes tagged "Auth" (from better-auth's merged OpenAPI document) now show their auth provider instead of "authenticated" or "public", making them easily identifiable. Also uses operation description as fallback when summary is missing.
