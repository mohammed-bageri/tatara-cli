---
"@tatara/authz": patch
---

`authzPlugin`: owners hold the creator's role. A member made `owner` later gets it, and an owner made `member` loses it. Authz roles given to someone who was never owner are left alone.
