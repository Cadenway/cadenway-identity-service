# cadenway-identity-service: Claude Code instructions

@AGENTS.md

Open this checkout as the session root to activate the [Claude Code tooling](.claude/README.md).
Rules without `paths` load at startup. Scoped rules load when a matching file is read.
Hooks run for the configured tool events. Follow the repo rules across tools and resolve
hook refusals without bypassing them.

Use `/cw-quality` with the shared [quality gate](docs/development.md#full-local-quality-gate).
Read module docs, contracts and task-specific skills as directed by `AGENTS.md`.

The sibling repositories (`../cadenway-api-contracts`, `../cadenway-service-kit`, `../cadenway-ops`, `../cadenway-api-gateway`) are read-only references
from here; add them to the session (`--add-dir`) when a task needs to read them.
