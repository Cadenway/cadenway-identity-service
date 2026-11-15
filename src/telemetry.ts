import { startTelemetry } from '@cadenway/nest-common/telemetry';

// Preloaded before the application: `node --experimental-loader=@cadenway/nest-common/hook.mjs
// --import ./dist/telemetry.js dist/main.js`. The instrumentations of HTTP, Express, pg and fetch
// must be registered before anything imports those modules, so this file imports nothing else.
// Traces and metrics leave as OTLP over HTTP to OTEL_EXPORTER_OTLP_ENDPOINT; unset, spans are
// still created (trace ids in the logs, `traceparent` propagated) and nothing leaves the process.
startTelemetry({ service: 'identity-service' });
