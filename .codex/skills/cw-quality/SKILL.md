---
name: cw-quality
description: Run the local quality gate, stopping at the first failure.
---

Run the gate yourself and report each step. No agent.

**With a test path**, pass the requested path to `pnpm test --` as one argument.
For a path that contains integration specs, also pass it to `pnpm test:integration --`.
Report the targeted checks and stop.

**Without an argument**, run in this order and stop at the first failure:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test:coverage` (unit)
5. `pnpm test:integration` (needs Docker for PostgreSQL and NATS)
6. `pnpm build`
7. `docker compose -f compose.dev.yaml config -q`

If a script does not exist yet (repository being bootstrapped), report it as **not available** rather than inventing an equivalent. On a failure, show the relevant output and propose the fix. End with one line per step: PASS, FAIL, not run or not available.
