---
name: cw-logging-and-tracing
description: "How a Cadenway backend logs, traces and measures itself: the log fields, what is masked, trace propagation over HTTP and NATS, the ESM start-up flags and the metrics. Load it before adding a log line, a span or a metric, or changing how the process starts."
---

# Logging and tracing

Logs, traces and metrics are plumbing of `@cadenway/nest-common` (pino and OpenTelemetry). A service
configures none of it: it logs through the injected logger and lets the kit instrument HTTP,
PostgreSQL and NATS. `cw-tech-opentelemetry` is the technology guide.

## Logs

- JSON on stdout, one object per line. `pino-pretty` is a dev dependency for local reading only; it
  never runs in the image.
- Fields the kit puts on every line: `service`, `version`, `traceId`, `spanId`, `organizationId`,
  `userId`, `route`, `status`, `durationMs`. Add context as structured fields, never by building a
  string.
- Masked by the kit: tokens, passwords, email addresses. Neither an email address nor an IP address
  at `info` level.
- The level comes from `LOG_LEVEL`. A failure that matters is logged once, at `error`, where it is
  handled.
- Tests never assert on log text.

## Traces

- W3C Trace Context: `traceparent` travels in HTTP headers and in NATS message headers, so one trace
  crosses the gateway, the use case, the outbox relay and the consumers.
- SQL values and query strings are excluded from spans.
- Export is OTLP over HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`.
- NestJS spans come from an interceptor of the kit: `@opentelemetry/instrumentation-nestjs-core`
  does not accept NestJS 12 and is not installed.

## Start-up (ESM)

The instrumentation must be loaded before the application imports Express, `pg` or the NATS client:

```bash
node --experimental-loader=@opentelemetry/instrumentation/hook.mjs --import ./telemetry.js dist/main.js
```

It is the only documented path for an ESM application. Node 24 marks `--experimental-loader` as
discouraged: keep the flags in one place (the image command and the start script) and change them
together.

## Metrics

- Per route: rate, errors, duration. Per service: outbox lag, consumer lag, connection pool.
- An alert fires at 24 hours of outbox or consumer lag.
- Labels stay bounded: a route template, never a raw path, an organization or a user.

## Health and shutdown

- `live`: the process answers. `ready`: database, NATS and migrations; it answers 503 as soon as
  SIGTERM is received.
- On SIGTERM, HTTP connections and NATS consumers are drained within the `stop_grace_period` of 30
  seconds.

## Configuration

`LOG_LEVEL` and `OTEL_EXPORTER_OTLP_ENDPOINT` are validated at start-up and described in
`.env.example`, like `PORT`, `DATABASE_URL` and `NATS_URL`. They are added with the kit version
that reads them.
