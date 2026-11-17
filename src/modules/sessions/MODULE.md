# Sessions

## Purpose

The sign-in sessions of the browsers:

- the opening of a session once the accounts module has verified a sign-in: an opaque token of 256
  random bits, returned once, of which only the SHA-256 is stored;
- the introspection the API gateway calls on every request that carries the session cookie;
- the revocation of a session (the sign-out);
- the browser of each session: address, `User-Agent` and the device `bowser` reads from it;
- the current organization of a session (P2b plan, decision 2): its choice, the last organization
  each account chose, where its next sessions start, and the organization, the role and the scopes
  of the introspection.

It does not own accounts, passwords or codes (the accounts module), nor the cookie, which the API
gateway sets from the token, nor the memberships, which it reads through the
`FindActiveMembership` provider of the memberships module behind its own `ActiveMemberships`
port.

## Public entry points

| Entry point                   | Consumers |
| ----------------------------- | --------- |
| `sessions.module`             | accounts  |
| `public/session/open-session` | accounts  |

`SessionsModule` exports the `OpenSession` provider. Accounts binds it to its own session opener
port. The public signature exposes `OpenSessionInput` and `OpenSessionOutput`.

## Owned tables

| Table                  | Key                       | Organization scoping                                        |
| ---------------------- | ------------------------- | ----------------------------------------------------------- |
| `sessions`             | `id`, unique `token_hash` | `organization_id`, the current one or `null`; policy forced |
| `organization_choices` | `user_id`                 | `organization_id`, the last one chosen; policy forced       |

`sessions` was created by `migrations/0001_accounts_and_sessions.sql`; its `organization_id` and
`member_id` (the membership it acts through, both `null` together) and `organization_choices` by
`migrations/0003_organization_context_and_api_tokens.sql`, which forces the policy of the kit on
both, as on every `organization_id`. `user_id` names an account of the accounts module and
`member_id` a membership of the memberships module, without a foreign key: a module never
references the tables of another. A session and a choice belong to an account, not to the
organization they name: every query runs in a system transaction and names its row by id, token
hash or account, and a user reaches only its own sessions.

## API

From `openapi/internal/identity-service.yaml` of the installed `@cadenway/contracts`; issuer
`api-gateway` only, no organization (one the internal token carries is ignored).

| Route                                                | Actor    | Success                     | Refusals                                                   |
| ---------------------------------------------------- | -------- | --------------------------- | ---------------------------------------------------------- |
| `POST /internal/v1/tokens/introspect`                | `system` | 200, `active` true or false | 400                                                        |
| `DELETE /internal/v1/sessions/{sessionId}`           | `user`   | 204                         | 400, 404 `session.not-found`                               |
| `PUT /internal/v1/sessions/{sessionId}/organization` | `user`   | 200, organization and role  | 400, 404 `session.not-found`, 404 `organization.not-found` |

Every route also answers the 401 and 403 of the internal token guard.

## Events emitted

| Event                | When                                        | Actor                   |
| -------------------- | ------------------------------------------- | ----------------------- |
| `session.revoked.v1` | An active session is revoked (the sign-out) | The user who revoked it |

Appended to the outbox in the system transaction of the revocation, with the version of the
session after the revocation (one more than its last choice of an organization) and
`organizationId: null`, which `asyncapi/identity-service.yaml` still fixes ("always `null` in this
version") although a session now names its current organization. A session that only expires, or
one revoked again, emits nothing. The choice of an organization emits nothing: the contract
declares no event for it. No rebuild use case exists yet: no consumer keeps a projection of
sessions.

## Events consumed

None directly. A `member.removed.v1` reaches the sessions through the copy of the memberships (the
memberships module): the introspection answers no organization for a session whose membership was
removed.

## Invariants

- A session ends at `expiresAt`, 30 days after the sign-in, whatever its activity; the cookie lasts
  until then with "Rester connecté pendant 30 jours", until the browser closes without it.
- Either session also ends after 12 hours without activity, as `openapi/public/auth.yaml` states for
  both; an active introspection is activity, recorded at most once a minute.
- A malformed, unknown, expired, inactive or revoked token introspects as `active: false`; so
  does a personal API token, introspected by its own route.
- A session acts on at most one organization, through a membership of its account in the copy of
  the memberships. Choosing it needs that membership to be active (`organization.not-found`
  otherwise, also for the few seconds before `member.joined.v1` arrives); choosing the current one
  again answers 200 and writes nothing; any other choice takes the next version of the session and
  becomes the last choice of the account.
- The introspection answers the organization and the role of the membership the session chose
  while that very membership is active, `null` for both otherwise: a removal ends the organization
  of the member's sessions there for good, and a person invited again chooses it again. A session
  holds every scope (`tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`).
- A new session starts in the last organization its account chose when the account still has an
  active membership there, else in none.
- A revoked session never becomes active again; revoking an ended session answers 204 and emits
  nothing; a session of another user answers like an unknown id.
- The token is never logged, never stored, never in an event; the address and the `User-Agent` are
  never logged with it.

## Transactions

`SystemSessionsUnitOfWork` runs each use case in one system transaction (see Decisions).
`OpenSession` runs inside the transaction of the sign-in of the accounts module and joins it, so a
session exists only if the sign-in commits (`tests/auth-flows.int-spec.ts` proves the rollback); it
reads the last choice of the account and the copy of the memberships in that transaction. The
revocation locks the session row, writes it and appends its event together. The choice of an
organization locks the session, reads the copy of the memberships, and writes the session and the
last choice together (`tests/organization-context.int-spec.ts` proves the rollback). The
introspection writes the last activity only when it moved by a minute, without a lock: a concurrent
later write wins; it reads the copy of the memberships in the same transaction.

## Decisions

- The decisions of the walking skeleton are recorded in `docs/integration.md`.
- The system transaction runner serves these routes, the same reviewed exception as in the accounts
  module: the kit README reserves it for "routes without an organization" and also says "never use
  it to serve the request of a user". The exception is bounded to the `sessions` table, which has no
  policy, and to outbox inserts with `organizationId: null`.
- The organization of a session (P2b plan, decision 2) did not move the module to the tenant
  runner, as an earlier note of this file expected: no route of the module has an organization in
  its internal token (the contract says so of the choice itself), the introspection learns the
  organization of a session only once it found it by its token, and the opening joins the system
  transaction of a sign-in. The column carries the forced policy of the kit all the same, and every
  query names its row.
- A session keeps the membership it acts through (`member_id`), not only the organization, so that
  `member.removed.v1` empties its organization without a write here: the memberships module marks
  the membership removed in its tenant transaction, which could not clear a `sessions` row, and the
  introspection compares the membership of the session with the active one. A person invited again
  gets a new membership and chooses the organization again; a new session starts there anyway,
  since the last choice keeps the organization, as the contract asks ("if they are still a member
  of it").
- The last choice of an account lives in `organization_choices`, one row per account, rather than
  being derived from its sessions, which a future purge of ended sessions would lose.
- The choice of the current organization again writes nothing, not even the last choice: the
  contract says it "changes nothing".
- `session.revoked.v1` keeps `organizationId: null`, as the contract fixes it for this version.
- The scopes of a session are the four of `ApiTokenScope`, kept in the domain
  (`SESSION_SCOPES`); a spec compares them with the installed contract.
- A session without "Rester connecté pendant 30 jours" has the same 30-day absolute bound as one
  with it: the contract requires a bound for both (`expiresAt`) and names none for a session cookie
  (decision 3).
- Persistent sessions also end after 12 hours of inactivity, because `openapi/public/auth.yaml`
  says "Either session also ends after 12 hours of inactivity by default"; a longer inactivity for
  them would start in cadenway-api-contracts.
- The token is SHA-256 hashed without a key: 256 random bits cannot be recovered from their hash.
- `tests/auth-flows.int-spec.ts` proves the introspection of an active, idle and revoked session,
  the revocation and its event, on real PostgreSQL and NATS; `tests/organization-context.int-spec.ts`
  the choice of an organization (member, non-member, removed, not there yet), the introspection with
  and without an organization, a new session starting in the last organization chosen, and a
  removal emptying the organization of the sessions.
