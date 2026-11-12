---
name: cw-contract-first
description: "The order in which a route or an event change travels: cadenway-api-contracts, then the producing service, then gateways and consumers, then the web app; and how to check the installed contract version. Load it before adding or changing a route or an event."
---

# Contract first

1. **cadenway-api-contracts**: the spec changes (OpenAPI for routes, AsyncAPI for events) with a
   changeset; CI checks for breaking changes; the packages are published.
2. **This service** receives the new `@cadenway/contracts` through a Renovate PR, then implements the
   route or emits the event.
3. **api-gateway and consumers** follow; **webapp** last.

Each step only adds, so each repository deploys alone. If the installed contract does not contain
what you need, stop and write the request for cadenway-api-contracts; never implement ahead of it
and never redefine a type locally.
