---
"@tatara/auth": patch
---

`requireOrg({ param: "orgId" })` takes the org from the path (`/orgs/:orgId/...`); a header can't override it.
