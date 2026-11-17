# Accounts

## Purpose

Who the person is and how they prove it before a session exists:

- users: name, address, language, the verified flag, the version of the account and its count of
  accepted sign-ups, and the profile of the mockup's "Profil" (display name, job title, time
  zone);
- password credentials: the argon2id hash of each password, with the pepper;
- one-time codes: the 6-digit codes of the email verification and of the sign-in by email, stored
  as keyed hashes, with their expiry and their wrong attempts;
- the throttle of the code requests and the lockout of the password sign-in, per address;
- the seven authentication flows, the reading of an account and the update of its profile.

It does not own sessions: a successful sign-in opens one through the sessions module, which owns
them, their introspection and their revocation.

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

`accounts.module.ts` registers the HTTP controllers and the module's providers. The
consumer-owned `SessionOpener` port is wired in `composition/providers/adapters/accounts/` to the
`OpenSession` provider exported by `sessions/public/session/open-session`. The provider mapping
preserves the active system transaction when a successful sign-in opens a session.

## Owned tables

| Table                  | Key                                    | Organization scoping                            |
| ---------------------- | -------------------------------------- | ----------------------------------------------- |
| `users`                | `id`, unique `email`                   | None: an account belongs to a person, no policy |
| `password_credentials` | `user_id` (cascade)                    | None: follows its account, no policy            |
| `one_time_codes`       | `id`; one current per user and purpose | None: follows its account, no policy            |
| `code_requests`        | `email`                                | None: per address, account or not, no policy    |
| `sign_in_attempts`     | `email`                                | None: per address, account or not, no policy    |

Created by `migrations/0001_accounts_and_sessions.sql`; `users.sign_up_count` by
`migrations/0002_sign_up_count.sql`, which backfills it from the version; `users.display_name`,
`users.job_title` and `users.time_zone` (default `Europe/Paris`) by
`migrations/0003_organization_context_and_api_tokens.sql`, the values of an account that never set
them. Row-level security applies to the tables
with an `organization_id` (`cw-database-conventions`); none of these has one, since the contracts
give an account, its codes and its lockout no organization (`organizationId` is always `null` in
`asyncapi/identity-service.yaml`). So they carry no policy and nothing to force: the barrier is
that every query names its account by id, or its address, or its code by account and purpose,
and that a user reads only the account of its verified internal token. The application role
`identity_app` reads and writes their rows and runs no DDL on them.

## API

From `openapi/internal/identity-service.yaml` of the installed `@cadenway/contracts`; issuer
`api-gateway` only, no organization.

| Route                                              | Actor       | Success     | Refusals                                                                                      |
| -------------------------------------------------- | ----------- | ----------- | --------------------------------------------------------------------------------------------- |
| `POST /internal/v1/auth/sign-in-methods`           | `anonymous` | 200         | 400                                                                                           |
| `POST /internal/v1/auth/sign-up`                   | `anonymous` | 202         | 400, 409 `auth.email-taken`, 422 terms or password, 429 `auth.code-throttled`                 |
| `POST /internal/v1/auth/sign-up/code`              | `anonymous` | 202         | 400, 429 `auth.code-throttled`                                                                |
| `POST /internal/v1/auth/sign-up/verification`      | `anonymous` | 200         | 400, 422 `auth.code-invalid`, `auth.code-expired`, `auth.sign-up-replaced`                    |
| `POST /internal/v1/auth/sign-in`                   | `anonymous` | 200         | 400, 403 `auth.email-not-verified`, 422 `auth.invalid-credentials`, 429 `auth.account-locked` |
| `POST /internal/v1/auth/sign-in/code`              | `anonymous` | 202         | 400, 429 `auth.code-throttled`                                                                |
| `POST /internal/v1/auth/sign-in/code/verification` | `anonymous` | 200         | 400, 422 `auth.code-invalid`, `auth.code-expired`                                             |
| `GET /internal/v1/users/{userId}`                  | `user`      | 200, `ETag` | 400, 404 `user.not-found`                                                                     |
| `PATCH /internal/v1/users/{userId}`                | `user`      | 200, `ETag` | 400, 404 `user.not-found`, 412 `request.version-mismatch`                                     |

Every route also answers the 401 and 403 of the internal token guard. A 429 carries `Retry-After`.

## Events emitted

All appended to the outbox in the transaction of the use case, in a system transaction, with
`organizationId: null`.

| Event                     | When                                                       | Actor                      |
| ------------------------- | ---------------------------------------------------------- | -------------------------- |
| `user.signed-up.v1`       | Each accepted sign-up, again with the next version         | The user                   |
| `user.email-verified.v1`  | The code of a sign-up is accepted                          | The user                   |
| `user.profile-updated.v1` | A profile patch changed something                          | The user                   |
| `one-time-code.issued.v1` | A code is issued (sign-up, new sign-up code, sign-in code) | `system`, identity-service |

`one-time-code.issued.v1` is restricted: listed in `restrictedEvents` from
`RESTRICTED_EVENT_NAMES`, it is published on `restricted.one-time-code.issued.v1` into
`EVENTS_RESTRICTED`, read by notification-service only. It is the only place the code exists in
clear, with its outbox row until the relay publishes it: the relay of `@cadenway/nest-messaging`
0.1.2 then replaces the payload with a redacted envelope in the statement that marks the row sent,
so a requeue never sends it again (a code lost with NATS is replaced by a new request). No rebuild
use case exists yet:
no consumer of these events keeps a projection to rebuild.

## Events consumed

None.

## Invariants

- An address is trimmed and lowercased once; every key by address uses that form.
- A password has 12 code points at least, no composition rule, and is refused when in the embedded
  list of compromised passwords (a short repository-authored list until the provenance of the full
  list is decided).
- A verified address cannot be signed up again (`auth.email-taken`); an unverified one keeps its
  account id and takes the new name and password, with the next version and one more accepted
  sign-up (a refused sign-up changes nothing).
- The verification is bound to the password of the latest sign-up (`@cadenway/contracts` 0.4.0).
  The code is checked first: a wrong or unusable one answers `auth.code-invalid` or
  `auth.code-expired` whatever `password` holds. With the right code, a `password` that differs
  from the one of the latest sign-up, or no `password` once the address was signed up more than
  once, answers `auth.sign-up-replaced` and the code stops working. Without `password`, an address
  signed up once is verified by its code alone.
- Codes: 6 digits, 10 minutes (`email-verification`, `sign-in`), single use, stopped by a newer code
  of the same account and purpose, and by the fifth wrong attempt. A code from an older email answers
  `auth.code-expired`, a wrong one `auth.code-invalid`.
- Code requests (sign-up included): one every 30 seconds per address, whatever the purpose, and 5 at
  most in an hour, whether or not an account uses the address; the answer is the same either way.
- Password lockout: per address, account or not; five consecutive failures lock the password
  sign-in for 15 minutes; `remainingAttempts` counts down from 4 to 1; a success resets it.
- Only a verified account signs in; an address without one answers like a wrong password or code.
- A user reads its own account only; another or unknown id answers `user.not-found`.
- The profile changes by a JSON Merge Patch of the account of the actor: a member left out is kept,
  `null` clears the display name or the job title; the name is trimmed (1 to 120), the display name
  (1 to 60) and the job title (1 to 120) too; the time zone is an IANA name the runtime knows,
  `Europe/Paris` until the person chooses another; the language is `fr`, `en`, `de` or `es`. A patch
  that moves something takes the next version and emits `user.profile-updated.v1` with the whole
  profile and the members that moved; one that moves nothing answers the same version and emits
  nothing. `If-Match`, optional, must name the current version (`request.version-mismatch` with
  `details.version` otherwise); `*` matches any.
- Never logged, never stored in clear by this module: a password, a code, a token or the pepper.

## Transactions

Each flow runs in system transactions of `SystemAccountsUnitOfWork` (see Decisions).

- Sign-up: the throttle row of the address is locked first, then the account; the account, its
  password hash, the throttle, the code and the two events commit together. The password is hashed
  before the transaction.
- Code request: the throttle row is locked and written, then a code and its event when an account
  is eligible, in one transaction.
- Verification and code sign-in: the current code is locked; its use, the verification and its
  event, and the session opened by the sessions module commit together. A wrong code is committed
  with its counted attempt, then refused. A sign-up verification with `password` runs in two
  transactions around the password check, as the password sign-in does: the first commits the use
  of the right code and reads the hash; the hash is checked outside any transaction; for the right
  password the second locks the account again and verifies it unless a sign-up replaced it
  meanwhile (`auth.sign-up-replaced`) or another code verified it (`auth.code-invalid`). The right
  code is used up by the first transaction, so a failure after it leaves the person to ask for a
  new code.
- Profile update: the account is locked, `If-Match` checked, and the account and its event commit
  together (`tests/profile.int-spec.ts` proves the rollback).
- Password sign-in: a first transaction locks the lockout row of the address, counts the attempt as
  a failure in advance and commits; the hash is checked outside any transaction; for the right
  password a second transaction resets the count and opens the session. Concurrent attempts of an
  address are counted one after the other, and the hash never holds a pooled connection.

## Decisions

- The decisions of the walking skeleton are recorded in `docs/integration.md`; the code cites them
  by number.
- The use cases run in the system transaction runner of the kit, a reviewed exception: the kit
  README reserves it for "work that crosses organizations or has none: outbox relay, schedules,
  events or routes without an organization", and also says "never use it to serve the request of a
  user". These routes and events have no organization, the tenant runner refuses to run without
  one, and the outbox policy accepts `organizationId: null` in a system transaction only. The
  exception is bounded: the system access touches the five tables above, which carry no policy,
  and the outbox inserts with `organizationId: null`. The session a sign-in opens joins the
  transaction and reads, through the sessions module, the last organization the account chose and
  its membership there (`organization_choices` and `memberships`, by account and organization);
  no other tenant table is read here. The contradiction of the kit README is reported to cadenway-service-kit.
- One module for users, credentials, codes and lockout: a sign-up writes the account, its password
  and its code atomically, and the verification reads the code and writes the account; splitting
  them would make each flow a chain of cross-module ports without another consumer.
- Common columns: `code_requests` and `sign_in_attempts` are keyed by the address and
  `password_credentials` by the account, without an `id`, since the key is their identity;
  `one_time_codes` has no `version`, since the contract fixes the version of a code at 1.
- Code hashes are HMAC-SHA-256 under a key derived from `PASSWORD_PEPPER` with HKDF, bound to the
  account and the purpose; the argon2 secret is derived from the same pepper under another label.
- `users.sign_up_count` counts the accepted sign-ups of an account (its replacements plus one)
  rather than deriving them from `version`, which any later change of an unverified account would
  move. Migration 0002 backfills it from `version` in one statement: no released version holds an
  account yet (0.2.0 has no accounts module), so 0001 and 0002 ship together and no running version
  can replace a pending account without counting it. Were a version with 0001 but without 0002
  ever deployed, a later migration would recount the unverified accounts whose `version` exceeds
  their count once it stopped.
- A blank display name or job title (spaces only) answers `400 request.invalid`, like a blank name,
  rather than clearing it: the contract clears them with `null` only. A malformed `If-Match` answers
  `400 request.invalid` with one issue on the header (`in: 'header'`, `invalid_format`), the code
  the contract declares, which `parseIfMatch` of `@cadenway/nest-common` raises itself from 0.6.0.
- The time zone is checked against `Intl.supportedValuesOf('timeZone')` of the runtime, and a link
  the runtime still resolves (`Asia/Calcutta`) is accepted as given; a UTC offset (`+01:00`), which
  the runtime also accepts as a time zone, is refused, not being an IANA name. That check, like the
  four languages of the contract, runs in the HTTP adapter: the time zone database is data of the
  runtime, kept at the edge, and the language enumeration is the contract's schema. The domain
  checks that both are set and not too long.
- The rows of `code_requests` and `sign_in_attempts` for addresses without an account, and expired
  codes, are not purged yet: a purge job arrives with the first durable job of the service.
- `tests/auth-flows.int-spec.ts` proves each route, the events and their routes, the binding of the
  verification to the password of the latest sign-up, concurrent attempts, the rollback of a unit of
  work, the redaction of a sent code in the outbox, and the absence of secrets from the logs, on real
  PostgreSQL and NATS; it reads codes from `EVENTS_RESTRICTED`, as notification-service does.
