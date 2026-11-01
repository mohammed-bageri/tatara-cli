---
"@tatara/cli": patch
"create-tatara": patch
---

Apps with the email add-on and no `emails/*.ts` templates typecheck again (`sendTemplate` read an empty list as `never`).
