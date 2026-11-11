---
paths:
  - 'Dockerfile'
  - 'deploy/**'
  - 'compose.dev.yaml'
  - '.env.example'
---

# Deployment files

- `deploy/compose.yaml` is this service's definition for Docker Compose; CI copies it into
  `waypoint-ops/services/identity-service.yaml` on each release. Keep it self-contained.
- The service is on the `internal` network only: no Traefik label, no published port.
- Every variable is listed in `.env.example` with a working local value; secret values never appear
  in this repository.
- Healthcheck on `/health/ready`; explicit memory limit; non-root user; pinned base image.
- Local port: 3010.
