# Sessions

## Purpose

The sign-in sessions of the browsers:

- the opening of a session once the accounts module has verified a sign-in: an opaque token of 256
  random bits, returned once, of which only the SHA-256 is stored;
- the introspection the API gateway calls on every request that carries the session cookie;
- the revocation of a session (the sign-out);
- the browser of each session: address, `User-Agent` and the device `bowser` reads from it.

It does not own accounts, passwords or codes (the accounts module), nor the cookie, which the API
gateway sets from the token.

## Public entry points

| Entry point                   | Consumers |
| ----------------------------- | --------- |
| `sessions.module`             | accounts  |
| `public/session/open-session` | accounts  |

`SessionsModule` exports the `OpenSession` provider. Accounts binds it to its own session opener
port. The public signature exposes `OpenSessionInput` and `OpenSessionOutput`.

## Owned tables

| Table      | Key                       | Organization scoping                           |
| ---------- | ------------------------- | ---------------------------------------------- |
| `sessions` | `id`, unique `token_hash` | None: a session belongs to no organization yet |

Created by `migrations/0001_accounts_and_sessions.sql`. `user_id` names an account of the accounts
module without a foreign key: a module never references the tables of another. The table has no
`organization_id`, hence no row-level security policy and nothing to force; every query names its
session by id or token hash, and a user revokes only its own sessions.

## API

From `openapi/internal/identity-service.yaml` of the installed `@cadenway/contracts`; issuer
`api-gateway` only, no organization.

| Route                                      | Actor    | Success                     | Refusals                     |
| ------------------------------------------ | -------- | --------------------------- | ---------------------------- |
| `POST /internal/v1/tokens/introspect`      | `system` | 200, `active` true or false | 400                          |
| `DELETE /internal/v1/sessions/{sessionId}` | `user`   | 204                         | 400, 404 `session.not-found` |

Every route also answers the 401 and 403 of the internal token guard.

## Events emitted

| Event                | When                                        | Actor                   |
| -------------------- | ------------------------------------------- | ----------------------- |
| `session.revoked.v1` | An active session is revoked (the sign-out) | The user who revoked it |

Appended to the outbox in the system transaction of the revocation, with `organizationId: null` and
the version of the session after the revocation (2). A session that only expires, or one revoked
again, emits nothing. No rebuild use case exists yet: no consumer keeps a projection of sessions.

## Events consumed

None. `member.removed` (closing the sessions of a removed member) arrives with the organization of
a session.

## Invariants

- A session ends at `expiresAt`, 30 days after the sign-in, whatever its activity; the cookie lasts
  until then with "Rester connecté pendant 30 jours", until the browser closes without it.
- Either session also ends after 12 hours without activity, as `openapi/public/auth.yaml` states for
  both; an active introspection is activity, recorded at most once a minute.
- A malformed, unknown, expired, inactive or revoked token introspects as `active: false`.
- A revoked session never becomes active again; revoking an ended session answers 204 and emits
  nothing; a session of another user answers like an unknown id.
- The token is never logged, never stored, never in an event; the address and the `User-Agent` are
  never logged with it.

## Transactions

`SystemSessionsUnitOfWork` runs each use case in one system transaction (see Decisions).
`OpenSession` runs inside the transaction of the sign-in of the accounts module and joins it, so a
session exists only if the sign-in commits (`test/auth-flows.int-spec.ts` proves the rollback). The
revocation locks the session row, writes it and appends its event together. The introspection
writes the last activity only when it moved by a minute, without a lock: a concurrent later write
wins.

## Decisions

- The decisions of the walking skeleton are recorded in `docs/integration.md`.
- The system transaction runner serves these routes, the same reviewed exception as in the accounts
  module: the kit README reserves it for "routes without an organization" and also says "never use
  it to serve the request of a user". The exception is bounded to the `sessions` table, which has no
  policy, and to outbox inserts with `organizationId: null`.
- Giving a session an organization (the organization selection) changes this design, in a
  migration and a release of its own: a nullable `organization_id` with the policy of the kit and
  its `FORCE` statement; the introspection and the revocation move to the tenant runner of the
  organization of the token; the opening at sign-in stays a system insert with no organization,
  since it joins the system transaction of the accounts module, and a new use case sets the
  organization; `member.removed` then closes the sessions of a member.
- A session without "Rester connecté pendant 30 jours" has the same 30-day absolute bound as one
  with it: the contract requires a bound for both (`expiresAt`) and names none for a session cookie
  (decision 3).
- Persistent sessions also end after 12 hours of inactivity, because `openapi/public/auth.yaml`
  says "Either session also ends after 12 hours of inactivity by default"; a longer inactivity for
  them would start in cadenway-api-contracts.
- The token is SHA-256 hashed without a key: 256 random bits cannot be recovered from their hash.
- `test/auth-flows.int-spec.ts` proves the introspection of an active, idle and revoked session,
  the revocation and its event, on real PostgreSQL and NATS.
