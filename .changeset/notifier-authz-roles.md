---
"@tatara/cli": patch
---

Notifying by role (`to: { role }`) in apps with organizations and authz reaches holders of the authz role. It used to match better-auth's member role, which is only owner or member since 0.13.0, so it reached nobody. `tatara upgrade` regenerates an untouched notifier, or says what to change.
