---
name: cw-deploy
description: Change the Dockerfile, deploy/compose.yaml or environment variables.
---

Delegate the user's arguments to **cw-identity-deploy-maintainer** if delegation is available and authorized.
Otherwise read and follow `.codex/agents/cw-identity-deploy-maintainer.toml` directly with those arguments.
Do not restate its rules or procedure.
