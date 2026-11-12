---
paths:
  - 'Dockerfile'
  - 'deploy/**'
  - 'compose.dev.yaml'
  - '.env.example'
---

# Deployment files

- `deploy/compose.yaml` is this service's definition for Docker Compose; on each release the deploy
  workflow checks it and copies it into cadenway-ops, as
  `environments/<env>/services/identity-service.yaml`. Keep it self-contained.
- The service is on the `internal` network only: no Traefik label, no published port.
- Every variable is listed in `.env.example` with a working local value; secret values never appear
  in this repository.
- Healthcheck on `/health/ready`; explicit memory limit; non-root user; pinned base image.
- Local port: 3010.
