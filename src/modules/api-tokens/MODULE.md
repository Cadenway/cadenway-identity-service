# API tokens

## Purpose

The personal API tokens of the account screen "Jetons d'API" (P2b plan, decision 6): a signed-in
person creates a token for the current organization of the session, lists the active ones and
revokes one; the API gateway introspects the bearer token of every request that carries one. A
token acts with the rights of its user in its organization, within its scopes.

It does not own the scopes a route requires nor the rate limit (the gateway), nor the memberships
(the memberships module, read through `FindActiveMembership`).

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

`ApiTokensModule` imports `MembershipsModule` and binds its own `ActiveMemberships` port to the
`FindActiveMembership` provider that module exports.

## Owned tables

| Table        | Key                       | Organization scoping                                     |
| ------------ | ------------------------- | -------------------------------------------------------- |
| `api_tokens` | `id`, unique `token_hash` | `organization_id`, policy of the kit, enabled and forced |

Created by `migrations/0003_organization_context_and_api_tokens.sql`, which forces the policy by
hand. `user_id` names an account of the accounts module without a foreign key. Index
`(organization_id, user_id, created_at, id)` for the list; `scopes` is a `text[]` with a `CHECK`
on the four known scopes, widened by a migration when the contract adds one.

## API

From `openapi/internal/identity-service.yaml` of the installed `@cadenway/contracts`; issuer
`api-gateway` only.

| Route                                         | Actor    | Organization | Success                     | Refusals                       |
| --------------------------------------------- | -------- | ------------ | --------------------------- | ------------------------------ |
| `POST /internal/v1/api-tokens`                | `user`   | Required     | 201, `Location`, secret     | 400                            |
| `GET /internal/v1/api-tokens`                 | `user`   | Required     | 200, one page               | 400                            |
| `DELETE /internal/v1/api-tokens/{apiTokenId}` | `user`   | Required     | 204                         | 400, 404 `api-token.not-found` |
| `POST /internal/v1/api-tokens/introspect`     | `system` | None         | 200, `active` true or false | 400                            |

Every route also answers the 401 and 403 of the internal token guard, `403
auth.organization-required` included for the routes of a session. The gateway answers `403
organization.not-selected` before the call when the session has no current organization, and
refuses a personal token on these routes (`403 auth.api-token-not-accepted`): only a session
manages tokens.

## Events emitted

None: the contract declares no token event.

## Events consumed

None directly. A removal reaches the tokens through the copy of the memberships: the introspection
answers `active: false` for a token whose user is no longer a member of its organization.

## Invariants

- The secret is `cw_pat_`, 30 base62 characters from `randomInt` of `node:crypto`, then 6 base62
  characters of the CRC32 of those 30 (`cw-identity-security`). It is returned once, by the
  creation; only its SHA-256 and its first 11 characters are stored; it is never logged, never in
  an event, never in a list.
- A token belongs to its user and to the organization of the internal token of its creation, the
  current organization of the session.
- Name trimmed, 1 to 100 characters; 1 to 4 scopes among `tasks:read`, `tasks:write`,
  `members:read`, `webhooks:manage`, a scope given twice counting once; expiry 30 days (default),
  90 days, 1 year (the same date of the next year, UTC) or never.
- A token is active when it is known by its hash, neither revoked nor expired, and its user has an
  active membership in its organization in the copy of the memberships. A malformed value, one
  whose check characters do not match, and a session token are inactive without a lookup.
- The list holds the tokens of the caller in the organization of the internal token that are
  neither revoked nor expired, the most recently created first.
- Revoking a revoked token answers 204 and changes nothing; a token of another user or
  organization answers like an unknown id.
- `lastUsedAt` is written by an active introspection at most once a minute, without a lock: a
  concurrent later write wins.

## Transactions

- Creation, list and revocation run in the tenant transaction of the organization of the internal
  token (`TenantApiTokensUnitOfWork`): the runner sets it, the policy of `api_tokens` keeps the
  work inside it, and every query names it again. The revocation locks the token.
- The introspection runs in one system transaction (`SystemApiTokensUnitOfWork`): it finds the
  token by its hash, reads the copy of the memberships in the same transaction, and writes the last
  use.

## Decisions

- The system runner serves the introspection, a bounded exception like the one of the sessions
  module: the gateway calls it as itself without an organization, and the organization of a token
  is known once it is found. The exception is bounded to reading one token by its hash and writing
  its last use; every other route uses the tenant runner.
- The secret is drawn with `randomInt` character by character, which has no modulo bias, and its
  CRC32 is computed by `crc32` of `node:zlib` over the 30 random characters, encoded in base62 with
  leading zeros. A CRC32 is not a security measure: it lets a malformed or truncated token be
  refused without a query, and a secret scanner recognize one.
- A token is bound to its organization, not to the membership of its creation: a person removed
  then invited again finds the tokens that are neither revoked nor expired working again, as the
  contract states ("A token of a removed member is inactive while the person is not a member, and
  active again, until revoked or expired, once they join the organization again with a new
  membership"). The sessions behave differently (see the sessions module).
- The query parameter `limit` is checked by the generated `ListApiTokensInternalQueryParams`
  alone, which reads it from its text with `Number()` (`@cadenway/contracts` 0.6.0): a value that
  is not then a whole number from 1 to 100 answers `400 request.invalid`.
- A cursor that is not one of this list answers `400 request.invalid` with one issue on `cursor`
  (`invalid_cursor`), the code the contract declares: `decodeCursor` of `@cadenway/nest-common`
  raises it for a malformed cursor or one issued for another sort, and the mapper raises the same
  for a decoded position this list never writes: an instant not in the form `toISOString` gives,
  or of a year outside 1970 to 9999, which PostgreSQL would refuse with a 500, or an id that is not
  a UUID. The cursor is not signed; it only moves the page within the caller's own tokens.
- `tests/organization-context.int-spec.ts` proves the lifecycle on real PostgreSQL and NATS:
  creation, introspection with scopes and organization, `lastUsedAt` written once a minute,
  revocation, expiry, and a removal of the membership.
