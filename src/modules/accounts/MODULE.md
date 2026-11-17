# Accounts

## Purpose

Who the person is and how they prove it, before and after a session exists:

- users: name, address, language, the verified flag, the version of the account and its count of
  accepted sign-ups, the profile of the mockup's "Profil" (display name, job title, time zone), when
  the password was last set, and a scheduled deletion;
- password credentials: the argon2id hash of each password, with the pepper;
- one-time codes: the 6-digit codes of the email verification, of the sign-in by email and of the
  change of address, stored as keyed hashes, with their expiry and their wrong attempts;
- password reset links ("Mot de passe oublié"), stored as the SHA-256 of their token;
- the pending change of address of each account, bound to the session that asked for it;
- the throttles of the code requests and of the reset requests, and the lockout of the password
  sign-in, per address;
- the seven authentication flows, the reading of an account and the update of its profile;
- the security of the account (P2c-1): the change and the reset of the password, the confirmation of
  the password in a session (re-authentication), the change of address, and the scheduling, the
  cancellation (by a sign-in) and the completion (by a durable job) of the deletion of the account.

It does not own sessions: a successful sign-in opens one through the sessions module, which owns
them, their introspection, their list, their revocation and their recent authentication; nor the
personal API tokens (the api-tokens module) nor the memberships (the memberships module).

## Public entry points

| Entry point | Consumers |
| ----------- | --------- |
| None        | None      |

`accounts.module.ts` registers the HTTP controllers, the job handlers and the module's providers. It
imports `SessionsModule`, `ApiTokensModule` and `MembershipsModule`, and binds its own ports to the
providers they export, in `composition/providers/adapters/accounts/`:

- `SessionOpener` to `sessions/public/session/open-session`;
- `AccountSessions` to `check-session-authentication`, `authenticate-session`,
  `end-recent-authentication`, `revoke-user-sessions`, `count-open-sessions` and
  `erase-user-sessions` of `sessions/public/session/`;
- `AccountApiTokens` to `revoke-user-api-tokens` and `erase-user-api-tokens` of
  `api-tokens/public/api-token/`;
- `OwnedOrganizations` to `memberships/public/membership/find-owned-organizations`.

Each of them runs in the system runner of the kit and joins the system transaction of the accounts
use case that calls it.

## Owned tables

| Table                     | Key                                    | Organization scoping                            |
| ------------------------- | -------------------------------------- | ----------------------------------------------- |
| `users`                   | `id`, unique `email`                   | None: an account belongs to a person, no policy |
| `password_credentials`    | `user_id` (cascade)                    | None: follows its account, no policy            |
| `one_time_codes`          | `id`; one current per user and purpose | None: follows its account, no policy            |
| `password_reset_links`    | `id`, unique `token_hash`; one current | None: follows its account (cascade), no policy  |
| `email_changes`           | `user_id` (cascade)                    | None: follows its account, no policy            |
| `code_requests`           | `email`                                | None: per address, account or not, no policy    |
| `password_reset_requests` | `email`                                | None: per address, account or not, no policy    |
| `sign_in_attempts`        | `email`                                | None: per address, account or not, no policy    |

Created by `migrations/0001_accounts_and_sessions.sql`; `users.sign_up_count` by
`migrations/0002_sign_up_count.sql`, which backfills it from the version; `users.display_name`,
`users.job_title` and `users.time_zone` (default `Europe/Paris`) by
`migrations/0003_organization_context_and_api_tokens.sql`, the values of an account that never set
them; `users.password_changed_at` (backfilled from the credential), `users.delete_at`,
`users.deletion_checked_at` (with a partial index on `delete_at`), `password_reset_links`,
`password_reset_requests` and `email_changes` by `migrations/0004_account_security.sql`.
`email_changes.session_id` names a session of the sessions module without a foreign key. Row-level
security applies to the tables with an `organization_id` (`cw-database-conventions`); none of these
has one, since the contracts give an account, its codes, its links and its lockout no organization
(`organizationId` is always `null` in `asyncapi/identity-service.yaml`). So they carry no policy and
nothing to force: the barrier is that every query names its account by id, or its address, or its
code by account and purpose, or its link by the hash of its token, and that a user reaches only the
account of its verified internal token. The application role `identity_app` reads and writes their
rows and runs no DDL on them.

The jobs of `account.deletion-sweep` and `account.delete` live in the `pgboss` schema of
`@cadenway/nest-jobs`, provisioned by `src/migrate.ts`; their payloads hold ids only.

## API

From `openapi/internal/identity-service.yaml` of the installed `@cadenway/contracts`; issuer
`api-gateway` only, no organization.

| Route                                                        | Actor       | Success         | Refusals                                                                                                                      |
| ------------------------------------------------------------ | ----------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `POST /internal/v1/auth/sign-in-methods`                     | `anonymous` | 200             | 400                                                                                                                           |
| `POST /internal/v1/auth/sign-up`                             | `anonymous` | 202             | 400, 409 `auth.email-taken`, 422 terms or password, 429 `auth.code-throttled`                                                 |
| `POST /internal/v1/auth/sign-up/code`                        | `anonymous` | 202             | 400, 429 `auth.code-throttled`                                                                                                |
| `POST /internal/v1/auth/sign-up/verification`                | `anonymous` | 200             | 400, 422 `auth.code-invalid`, `auth.code-expired`, `auth.sign-up-replaced`                                                    |
| `POST /internal/v1/auth/sign-in`                             | `anonymous` | 200             | 400, 403 `auth.email-not-verified`, 422 `auth.invalid-credentials`, 429 `auth.account-locked`                                 |
| `POST /internal/v1/auth/sign-in/code`                        | `anonymous` | 202             | 400, 429 `auth.code-throttled`                                                                                                |
| `POST /internal/v1/auth/sign-in/code/verification`           | `anonymous` | 200             | 400, 422 `auth.code-invalid`, `auth.code-expired`                                                                             |
| `POST /internal/v1/auth/password-reset`                      | `anonymous` | 202             | 400, 429 `auth.reset-throttled`                                                                                               |
| `POST /internal/v1/auth/password-reset/inspection`           | `anonymous` | 200             | 400, 422 `auth.reset-link-expired`                                                                                            |
| `POST /internal/v1/auth/password-reset/confirmation`         | `anonymous` | 200             | 400, 422 `auth.reset-link-expired`, `auth.password-too-short`, `auth.password-compromised`                                    |
| `POST /internal/v1/sessions/{sessionId}/reauthentication`    | `user`      | 200             | 400, 404 `session.not-found`, 422 `auth.password-incorrect`, 429 `auth.account-locked`                                        |
| `GET /internal/v1/users/{userId}`                            | `user`      | 200, `ETag`     | 400, 404 `user.not-found`                                                                                                     |
| `PATCH /internal/v1/users/{userId}`                          | `user`      | 200, `ETag`     | 400, 404 `user.not-found`, 412 `request.version-mismatch`                                                                     |
| `PUT /internal/v1/users/{userId}/password`                   | `user`      | 200, `ETag`     | 400, 404 `user.not-found`, `session.not-found`, 422 password rules or `auth.password-incorrect`, 429 `auth.account-locked`    |
| `POST /internal/v1/users/{userId}/email-change`              | `user`      | 202             | 400, 403 `auth.reauthentication-required`, 404, 409 `auth.email-taken`, 422 `auth.email-unchanged`, 429 `auth.code-throttled` |
| `POST /internal/v1/users/{userId}/email-change/confirmation` | `user`      | 200, `ETag`     | 400, 404, 409 `auth.email-taken`, 422 `auth.code-invalid`, `auth.code-expired`                                                |
| `POST /internal/v1/users/{userId}/deletion`                  | `user`      | 202, `deleteAt` | 400, 403 `auth.reauthentication-required`, 404, 409 `account.organization-owner`                                              |

Every route also answers the 401 and 403 of the internal token guard. A 429 carries `Retry-After`.
The sign-ins answer `deletionCancelled` in their `200`. `403 auth.reauthentication-required` carries
`details.methods: [password]`; `409 account.organization-owner` carries `details.organizationIds`.

## Events emitted

All appended to the outbox in the transaction of the use case, in a system transaction, with
`organizationId: null`.

| Event                           | When                                                                      | Actor                                    |
| ------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| `user.signed-up.v1`             | Each accepted sign-up, again with the next version                        | The user                                 |
| `user.email-verified.v1`        | The code of a sign-up is accepted                                         | The user                                 |
| `user.profile-updated.v1`       | A profile patch changed something                                         | The user                                 |
| `user.password-changed.v1`      | A change (`method: change`) or a reset (`method: reset`) of the password  | The user                                 |
| `user.email-changed.v1`         | The code of a change of address is accepted                               | The user                                 |
| `user.deletion-scheduled.v1`    | The deletion of the account is scheduled                                  | The user                                 |
| `user.deletion-cancelled.v1`    | A sign-in of an account whose deletion is scheduled                       | The user                                 |
| `user.deleted.v1`               | The durable job deletes the account at `deleteAt`                         | `system`, identity-service               |
| `one-time-code.issued.v1`       | A code is issued (sign-up, sign-up code, sign-in code, change of address) | `system`; the user for an `email-change` |
| `password-reset-link.issued.v1` | A reset link is issued to a verified account                              | `system`, identity-service               |

The security events carry what their e-mail shows: the address and name of the account, its language
and time zone, and, where the contract says so, the device (read from the `User-Agent` by `bowser`)
and the address of the browser; never a password, a code, a token or a link, but the two restricted
ones. `session.revoked.v1` and `session.opened-on-new-device.v1`, which these flows cause, are
appended by the sessions module in the same transaction.

`one-time-code.issued.v1` and `password-reset-link.issued.v1` are restricted: listed in
`restrictedEvents` from `RESTRICTED_EVENT_NAMES`, they are published on `restricted.<name>` into
`EVENTS_RESTRICTED`, read by notification-service only. They are the only places the code and the
reset token exist in clear, with their outbox rows until the relay publishes them: the relay of
`@cadenway/nest-messaging` then replaces the payload with a redacted envelope in the statement that
marks the row sent, so a requeue never sends it again (a code or a link lost with NATS is replaced
by a new request). The code of a change of address goes to the new address, credited to the user. No
rebuild use case exists yet: no consumer of these events keeps a projection to rebuild.

## Events consumed

None.

## Invariants

- An address is trimmed and lowercased once; every key by address uses that form.
- A password has 12 code points at least, no composition rule, and is refused when in the embedded
  list of compromised passwords (a short repository-authored list until the provenance of the full
  list is decided). The same rules apply to a change and a reset (decision 1 of P2c).
- A verified address cannot be signed up again (`auth.email-taken`); an unverified one keeps its
  account id and takes the new name and password, with the next version and one more accepted
  sign-up (a refused sign-up changes nothing).
- The verification is bound to the password of the latest sign-up (`@cadenway/contracts` 0.4.0).
  The code is checked first: a wrong or unusable one answers `auth.code-invalid` or
  `auth.code-expired` whatever `password` holds. With the right code, a `password` that differs
  from the one of the latest sign-up, or no `password` once the address was signed up more than
  once, answers `auth.sign-up-replaced` and the code stops working. Without `password`, an address
  signed up once is verified by its code alone.
- Codes: 6 digits, 10 minutes (`email-verification`, `sign-in`) or 15 (`email-change`), single use,
  stopped by a newer code of the same account and purpose, and by the fifth wrong attempt. A code
  from an older email answers `auth.code-expired`, a wrong one `auth.code-invalid`.
- Code requests (sign-up and change of address included, counted on the new address): one every 30
  seconds per address, whatever the purpose, and 5 at most per address in an hour, whether or not an
  account uses the address; the answer is the same either way.
- Password lockout: per address, account or not; five consecutive failures lock the password
  sign-in for 15 minutes; `remainingAttempts` counts down from 4 to 1; a success resets it. The
  failed current passwords of the re-authentication and of the change count with the sign-ins of
  the address of the account, and both answer `auth.account-locked` during a lockout without
  closing the session; a completed reset ends the count.
- Only a verified account signs in; an address without one answers like a wrong password or code.
- A user reads and changes its own account only; another or unknown id answers `user.not-found`; a
  session of the request that is not an open session of the actor answers `session.not-found`.
- The profile changes by a JSON Merge Patch of the account of the actor: a member left out is kept,
  `null` clears the display name or the job title; the name is trimmed (1 to 120), the display name
  (1 to 60) and the job title (1 to 120) too; the time zone is an IANA name the runtime knows,
  `Europe/Paris` until the person chooses another; the language is `fr`, `en`, `de` or `es`. A patch
  that moves something takes the next version and emits `user.profile-updated.v1` with the whole
  profile and the members that moved; one that moves nothing answers the same version and emits
  nothing. `If-Match`, optional, must name the current version (`request.version-mismatch` with
  `details.version`); `*` matches any.
- `passwordChangedAt` is set by the sign-up (and a later sign-up of a pending account), a change and
  a reset; a change and a reset take the next version.
- A change of password checks, in this order, the account and the session, the new password
  (without counting an attempt), then the current one. It keeps every session open, records a recent
  authentication of the session of the request, ends the recent authentication of the others, and
  drops a pending change of address (decision 3 of P2c).
- A reset link works once, for 30 minutes, from any browser; a newer link of the account and a
  change of address void it. A request answers the same way whether or not a verified account uses
  the address; requests of an address are throttled apart from the codes: 45 seconds and 5 an hour
  (`auth.reset-throttled`). Reading a link does not use it. A reset checks the link first, then the
  new password, which leaves the link usable; it never signs in, closes every session unless
  `closeOtherSessions` is `false` (and ends their recent authentication otherwise), ends the lockout
  of the address, drops a pending change of address, keeps the personal API tokens and a scheduled
  deletion (decision 2 of P2c).
- A change of address needs a recent authentication of the session (decision 4); the new address is
  not the current one and no verified account uses it. The pending change belongs to the session
  that asked: a confirmation from another session, or without a pending change, answers
  `auth.code-invalid`; a newer request replaces it and its code; a change or a reset of the password,
  and the scheduling of the deletion, drop it. A verified account that took the new address since
  the request answers `auth.email-taken` and drops the change; an unverified sign-up of the new
  address ends (its account is deleted). The confirmation makes the new address the verified address
  of the account with the next version, and voids every current code and the current reset link of
  the account; the sessions and the personal API tokens stay (decision 5).
- The deletion is refused to the owner of an organization in the copy of the memberships, checked
  first (`account.organization-owner`), then to a session without a recent authentication. It is
  scheduled 30 days ahead with the next version; every session (the one of the request included) and
  every personal API token are revoked at once, and a pending change of address is dropped. A
  sign-in by password or by code cancels it, with the next version (`deletionCancelled`); nothing
  else does. At `deleteAt` the durable job checks the copy of the memberships again: an owner then is
  kept, still scheduled, and checked again an hour later until it owns none or signs in; otherwise
  the account is erased (decision 9).
- Erased with the account: the row of `users` (name, address, profile, preferences), its password,
  codes, reset links and pending change of address (by their foreign keys), its sessions with their
  address and `User-Agent` and its last organization choice (the sessions module), its personal API
  tokens (the api-tokens module), and the throttles and lockout rows of its address. Kept: the copy
  of its memberships (ids and role), until the `member.removed.v1` organization-service emits on
  `user.deleted.v1` reaches it; the outbox rows of its past events, until their purge after 7 days
  (the restricted ones already redacted); the processed ids of the kit; the logs.
- "Nouvelle connexion": the password and the code sign-ins ask the sessions module to tell of a
  device the account did not use in the last 90 days; the sign-up verification, the first session of
  the account, asks for nothing.
- Never logged, never stored in clear by this module: a password, a code, a token, a reset link or
  the pepper.

## Transactions

Each flow runs in system transactions of `SystemAccountsUnitOfWork` (see Decisions). The ports of
the sessions, api-tokens and memberships modules join the transaction of the use case.

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
  password a second transaction resets the count, locks the account, opens the session, cancels a
  scheduled deletion and appends its event. Concurrent attempts of an address are counted one after
  the other, and the hash never holds a pooled connection. The code sign-in locks the account in its
  one transaction and does the same.
- Re-authentication and change of password: the same three steps around the hash (the change adds a
  first read-only transaction for the account and the session, and the hash of the new password
  outside any transaction); the last transaction ends the count, records the recent authentication
  through the sessions module and, for a change, writes the hash, the account, the dropped change of
  address, the end of the recent authentication of the other sessions and the event together.
- Reset request: the throttle row of the address is locked and written, then the previous link is
  replaced, the new one stored and its restricted event appended, in one transaction; the token is
  drawn and the device read before it, whatever the address.
- Reset confirmation: a first transaction reads the link; the new password is checked and hashed
  outside any transaction; the second locks the account, then the link, checks it again, and uses
  it, writes the hash and the account, ends the lockout, drops the change of address, revokes the
  sessions or ends their recent authentication, and appends the events together.
- Change of address: the request locks the account, checks the session, the throttle and writes the
  pending change, the code and its event in one transaction; the confirmation locks the account,
  checks the session, the pending change and the code (a wrong one committed with its attempt),
  deletes an unverified sign-up of the new address, writes the account, voids the codes and the link
  and appends its event in one transaction.
- Scheduling of the deletion: the account is locked; the ownership, the session, the account, the
  revocation of the sessions and of the tokens, the dropped change of address and the events commit
  together.
- Completion of the deletion: the sweep (`EnqueueDueAccountDeletions`, job `account.deletion-sweep`,
  every 10 minutes in UTC) claims the due accounts with `for update skip locked` and enqueues one
  `account.delete` job per account through the connection of its transaction, with the occurrence key
  `<userId>:<instant it became due or was last checked>`; each job (`CompleteAccountDeletion`) locks
  the account, checks again that its deletion is due and the ownership, and erases the account,
  appending `user.deleted.v1`, in one transaction.

## Decisions

- The decisions of the walking skeleton are recorded in `docs/integration.md`; the code cites them
  by number. The decisions of P2c are those of its brief (password rules, reset link, change of
  password, recent authentication, change of address, deletion, security e-mails).
- The use cases run in the system transaction runner of the kit, a reviewed exception: the kit
  README reserves it for "work that crosses organizations or has none: outbox relay, schedules,
  events or routes without an organization", and also says "never use it to serve the request of a
  user". These routes and events have no organization, the tenant runner refuses to run without
  one, and the outbox policy accepts `organizationId: null` in a system transaction only. The
  exception is bounded: the system access touches the eight tables above, which carry no policy,
  the outbox inserts with `organizationId: null`, and the rows of the other modules each port names
  by session id or account: the sessions and the last choice of the account, its personal API tokens
  in every organization (revoked at the scheduling, erased at the deletion), and the copy of its
  memberships (read by account for the ownership). The contradiction of the kit README is reported
  to cadenway-service-kit.
- One module for users, credentials, codes, links, changes of address and lockout: a sign-up writes
  the account, its password and its code atomically, a reset writes the link, the password and the
  account, and a confirmation of address reads the code and writes the account; splitting them would
  make each flow a chain of cross-module ports without another consumer.
- Common columns: `code_requests`, `password_reset_requests` and `sign_in_attempts` are keyed by the
  address, and `password_credentials` and `email_changes` by the account, without an `id`, since the
  key is their identity; `one_time_codes` and `password_reset_links` have no `version`, since the
  contract fixes the version of a code and of a link at 1.
- Code hashes are HMAC-SHA-256 under a key derived from `PASSWORD_PEPPER` with HKDF, bound to the
  account and the purpose; the argon2 secret is derived from the same pepper under another label.
  A reset token is 256 random bits, hashed with SHA-256 without a key, like a session token: it
  cannot be recovered from its hash. A malformed token answers `auth.reset-link-expired` without a
  lookup.
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
- The order of the checks where the contract names none: the account and the session of the request
  (`404`) come before every other refusal of a route of the account, since they address the request.
  For the deletion, the ownership (`409`) is then checked before the recent authentication (`403`),
  as the contract orders them.
- The reset request draws its token and reads the device before its transaction and takes the same
  locks whatever the address, so an address without a verified account differs only by the absence
  of the insert of the link and of its outbox row; no artificial delay is added. The 5-per-hour cap of
  the resets is the contract's and the brief's, left open to the user.
- The pending change of address is not deleted when its session ends: the confirmation requires that
  session to be open and to be the one that asked, so a change of an ended session can never be
  confirmed, and the next request replaces it.
- The unverified sign-up of a new address that a change of address takes is deleted without an
  event: `user.deleted.v1` is the end of a scheduled deletion in the contract, and no event of the
  contract says a pending sign-up ended. organization-service keeps that pending account in its
  directory as an unverified one; this is reported as an open point.
- The device of the security e-mails is read by the shared `bowser` reader of
  `src/infrastructure/`, bound to the `DeviceReader` port of this module, as the sessions module
  binds its own. No place is derived from the address.
- The final deletion runs on `@cadenway/nest-jobs`, a sweep and one job per account, as `cw-jobs`
  prescribes: the business table is the source of truth (`delete_at`, `deletion_checked_at`), the
  sweep claims the due rows and enqueues one job per row, and the job checks the row again before
  acting. A deletion is completed within about 10 minutes of `deleteAt` (the cron, the 40 seconds of
  the evaluation of a schedule, the poll of the worker). An account kept for its ownership is checked
  again an hour after its last check, with a new occurrence key. `account.delete` retries 5 times
  with backoff from 30 seconds up to 10 minutes; a job given up becomes a dead letter of
  `account.delete.dead-letter`, kept 14 days, and the dead-letter watch of the kit logs it at
  `error`: an operator reads the error of the dead letter, fixes the cause, and either waits for the
  sweep to enqueue the account again once the failed job row is purged (about a day,
  `deleteAfterSeconds` plus the daily maintenance of pg-boss) or runs the job again from the pg-boss
  tooling. The jobs pool holds 2 connections of its own, besides the 5 of the application pool.
- `tests/auth-flows.int-spec.ts` proves each authentication route, the events and their routes, the
  binding of the verification to the password of the latest sign-up, concurrent attempts, the
  rollback of a unit of work, the redaction of a sent code in the outbox, and the absence of secrets
  from the logs; `tests/account-security.int-spec.ts` proves every route of the security of the
  account with its success and error codes, the lockout shared with the sign-in, the windows of
  recent authentication, the reset link on `restricted.` only and redacted once sent, the change of
  address bound to its session, the scheduling, the cancellation by a sign-in, the completion by the
  durable job with its check of the ownership, "Nouvelle connexion", and the absence of passwords,
  codes, tokens and reset links from the logs, on real PostgreSQL and NATS. Both read codes and links
  from `EVENTS_RESTRICTED`, as notification-service does.
