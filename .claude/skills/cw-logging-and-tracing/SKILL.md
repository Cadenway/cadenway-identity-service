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
node --max-old-space-size=160 --import @cadenway/nest-common/register --import ./dist/telemetry.js dist/main.js
```

- `@cadenway/nest-common/register` registers the module hooks of the OpenTelemetry instrumentations
  with `module.register()`. It is named through the kit: `@opentelemetry/instrumentation` is a
  dependency of the kit, not of the service, and pnpm's strict `node_modules` does not resolve it
  from here. Unlike the former `--experimental-loader=@cadenway/nest-common/hook.mjs`, it prints no
  `ExperimentalWarning`.
- `src/telemetry.ts` calls `startTelemetry` of `@cadenway/nest-common/telemetry` and imports
  nothing else; it must come after the hooks, hence the order of the two `--import`.
- `--max-old-space-size=160` caps the old generation of the heap at about 60 % of the 256M limit of
  the container, so the garbage collector reclaims it before the limit is reached (README of
  `@cadenway/nest-common`, "Memory"). Measure the resident memory before lowering the limit.
- `src/main.ts` runs inside `runApplication`: a failed start-up is one JSON line on the standard
  error (`level: 'fatal'`, `msg: 'start-up failed'`, the `issues` of a `ConfigError`), then exit
  code 1.

Keep the flags in one place (the `CMD` of the `Dockerfile` and the `start:dev` script) and change
them together.

## Metrics

- Per route: rate, errors, duration. Per service: outbox lag, consumer lag, connection pool.
- An alert fires at 24 hours of outbox or consumer lag.
- Labels stay bounded: a route template, never a raw path, an organization or a user.

## Health and shutdown

- `live`: the process answers, and keeps answering 200 until the listener closes. `ready`:
  PostgreSQL (`postgresIndicator`) and NATS (`messagingHealthIndicator`: connection open, every
  durable consumer working, a flush round trip), each within 1 second; 503 as soon as the shutdown
  starts. The kit does not check migrations: the GitOps agent applies them before it starts a
  version.
- On SIGTERM the relay finishes its pass, the consumers stop and their running handlers finish, the
  listener closes, then the NATS connection drains and the pool closes. The GitOps agent stops a
  replaced container with `docker stop --time 30`; any other stop gets the 10 seconds of Docker,
  since the deploy definition may not set `stop_grace_period`.
- `shutdownDelayMs` is 0: nothing that routes to this internal service reads its readiness. Its
  callers resolve it through the Docker DNS of the `internal` network, which keeps returning a
  stopping container until it exits, so a delay would only lengthen the stop. Set it above the probe
  interval of a proxy if one ever routes to the service on readiness.

## Configuration

`NODE_ENV`, `LOG_LEVEL` and `LOG_PRETTY` are validated at start-up against the schema of
`src/config/app-config.ts` (`baseConfigShape` of the kit) and `OTEL_EXPORTER_OTLP_ENDPOINT` by
`startTelemetry`; all are described in `.env.example`, like `PORT`, `DATABASE_URL` and `NATS_URL`.
`LOG_PRETTY=true` is a local convenience, refused with `NODE_ENV=production`.
