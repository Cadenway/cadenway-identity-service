---
name: cw-logging-and-tracing
description: "How a Cadenway backend logs, traces and measures itself: the log fields, what is masked, trace propagation over HTTP and NATS, the ESM start-up flags and the metrics. Load it before adding a log line, a span or a metric, or changing how the process starts."
---

# Logging and tracing

Logs, traces and metrics are plumbing of `@cadenway/nest-common` (pino and OpenTelemetry). A service
configures none of it: it logs through the injected logger and lets the kit instrument HTTP,
PostgreSQL and NATS. `cw-tech-opentelemetry` is the technology guide.

Use structured, redacted logs, propagate trace context, and keep metric labels bounded. Load the
relevant section only:

- Add or change logging: [log fields, masking and levels](references/observability.md#logs).
- Instrument HTTP, SQL or messaging: [traces and export](references/observability.md#traces).
- Add metrics or lag alerts: [aggregation and labels](references/observability.md#metrics).
- Change the entrypoint, image or runtime settings:
  [ESM start-up](references/observability.md#start-up-esm) and
  [configuration](references/observability.md#configuration).
- Change readiness or process termination:
  [health and shutdown](references/observability.md#health-and-shutdown).
