# syntax=docker/dockerfile:1

# Node 24 on Alpine, pinned by tag and digest; Renovate updates both together.
FROM node:24.22.3-alpine3.24@sha256:98e4e60b35fd50143e1838da2957488c25aa3a3efbd48bb679923f77d6d3d873 AS patched-alpine
# Apply the Alpine 3.24 security updates that postdate this image.
RUN apk add --no-cache libcrypto3=3.5.9-r1 libssl3=3.5.9-r1 zlib=1.4-r0

FROM patched-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
# Corepack installs the pnpm version named by `packageManager` in package.json.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

FROM base AS build
# The @cadenway/* packages are private, and pnpm ignores a token written in the project .npmrc.
# The install steps therefore mount a user-level npmrc as a build secret: it exists for that step
# only and reaches no layer. Build with `docker build --secret id=npmrc,env=NPMRC .`.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=true \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir /pnpm/store
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=secret,id=npmrc,target=/root/.npmrc,required=true \
    pnpm install --prod --frozen-lockfile --ignore-scripts --store-dir /pnpm/store

FROM patched-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3010
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Read by the one-off migration container: `node dist/migrate.js`.
COPY migrations ./migrations
USER node
EXPOSE 3010
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health/ready" || exit 1
# The OpenTelemetry instrumentations are registered before the application loads Express or pg:
# the module hooks of @cadenway/nest-common/register, then dist/telemetry.js, then dist/main.js.
# --max-old-space-size=160 caps the old generation of the heap at about 60 % of the 256M limit of
# deploy/compose.yaml, so the garbage collector reclaims it before the container reaches its limit
# (README of @cadenway/nest-common, "Memory"). The same flags are in the start:dev script of
# package.json; change them together.
CMD ["node", "--max-old-space-size=160", "--import", "@cadenway/nest-common/register", "--import", "./dist/telemetry.js", "dist/main.js"]
