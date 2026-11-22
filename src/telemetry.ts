import { startTelemetry } from '@cadenway/nest-common/telemetry';

// Preloaded before the application: `node --max-old-space-size=160 --import
// @cadenway/nest-common/register --import ./dist/telemetry.js dist/main.js`. The register entry point
// installs the module hooks first; the instrumentations of HTTP, Express, pg and fetch must then be
// registered before anything imports those modules, so this file imports nothing else. Traces and
// metrics leave as OTLP over HTTP to OTEL_EXPORTER_OTLP_ENDPOINT; unset, spans are still created
// (trace ids in the logs, `traceparent` propagated over HTTP and NATS) and nothing leaves the
// process.
startTelemetry({
  service: 'identity-service',
  sensitiveHttpPathPrefixes: ['/internal/v1/users/', '/internal/v1/auth/sign-in/federated/'],
});
