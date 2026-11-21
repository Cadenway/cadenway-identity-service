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
  cancellation (by a sign-in) and the completion (by a durable job) of the deletion of the account;
- the two-step verification of the account (P2c-2, decisions 7 and 8 of P2c; Mfa and Compte ›
  Sécurité of the mockup): the authenticator app (TOTP, RFC 6238), its secret sealed at rest; the
  10 backup codes, stored as keyed hashes; up to 10 security keys (WebAuthn); the two-step challenge
  of the sign-ins, answered with the app, a backup code or a key; the re-authentication with a code
  of the app; and the disabling, refused while the policy of an organization requires it.

It does not own sessions: a successful sign-in opens one through the sessions module, which owns
them, their introspection, their list, their revocation and their recent authentication, the
trusted devices, the fact that an account has two-step verification, and the authentication
policies of the organizations; nor the personal API tokens (the api-tokens module) nor the
memberships (the memberships module).

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
- `OwnedOrganizations` to `memberships/public/membership/find-owned-organizations`;
- in `composition/providers/adapters/two-step/`, `TrustedDevices` to `trust-device`,
  `check-trusted-device` and `forget-trusted-devices` of `sessions/public/trusted-device/`,
  `TwoStepEnrollments` to `sessions/public/session/record-two-step-verification`, and
  `TwoStepRequirements` to `sessions/public/authentication-policy/find-two-step-requirements`.

Each of them runs in the system runner of the kit and joins the system transaction of the accounts
use case that calls it.

## Owned tables

| Table                        | Key                                                     | Organization scoping                             |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `users`                      | `id`, unique `email`                                    | None: an account belongs to a person, no policy  |
| `avatar_uploads`             | `id`, unique owner and idempotency digest               | None: follows its account, no policy             |
| `password_credentials`       | `user_id` (cascade)                                     | None: follows its account, no policy             |
| `one_time_codes`             | `id`; one current per user and purpose                  | None: follows its account, no policy             |
| `password_reset_links`       | `id`, unique `token_hash`; one current                  | None: follows its account (cascade), no policy   |
| `email_changes`              | `user_id` (cascade)                                     | None: follows its account, no policy             |
| `code_requests`              | `email`                                                 | None: per address, account or not, no policy     |
| `password_reset_requests`    | `email`                                                 | None: per address, account or not, no policy     |
| `sign_in_attempts`           | `email`                                                 | None: per address, account or not, no policy     |
| `two_step_verifications`     | `user_id` (cascade), unique `webauthn_user_handle`      | None: follows its account, no policy             |
| `backup_codes`               | `id`, unique (`user_id`, `code_hash`) (cascade)         | None: follows its account, no policy             |
| `security_keys`              | `id`, unique `credential_id` (cascade)                  | None: follows its account, no policy             |
| `authenticator_app_setups`   | `user_id` (cascade)                                     | None: follows its account, no policy             |
| `security_key_registrations` | `user_id` (cascade)                                     | None: follows its account, no policy             |
| `sign_in_challenges`         | `id`, unique `user_id`, unique `token_hash` (cascade)   | None: follows its account, no policy             |
| `federated_account_links`    | digest of provider, issuer and subject, account cascade | None: follows its account, no policy             |
| `federated_sign_in_flows`    | `id`, unique state and optional receipt digest          | None: follows a browser-bound sign-in, no policy |

Created by `migrations/0001_accounts_and_sessions.sql`; `users.sign_up_count` by
`migrations/0002_sign_up_count.sql`, which backfills it from the version; `users.display_name`,
`users.job_title` and `users.time_zone` (default `Europe/Paris`) by
`migrations/0003_organization_context_and_api_tokens.sql`, the values of an account that never set
them; `users.password_changed_at` (backfilled from the credential), `users.delete_at`,
`users.deletion_checked_at` (with a partial index on `delete_at`), `password_reset_links`,
`password_reset_requests` and `email_changes` by `migrations/0004_account_security.sql`.
The six tables of two-step verification come from `migrations/0005_two_step_verification.sql`, which
only creates them (expand only): `two_step_verifications` holds the sealed secret of the app
(`authenticator_secret`), when it was configured, the last accepted time step, the WebAuthn handle of
the account, the count of wrong answers (0 to 5, checked) and the end of a lockout, when the backup
codes were generated and when two-step verification was turned on; `backup_codes` the HMAC of each
code and when it was used; `security_keys` the credential id, the public key (COSE, base64url), the
signature counter, the transports, the backup flags and the last use of each key, read by account
through the index on `user_id`; `authenticator_app_setups` and `security_key_registrations` the one
pending setup and registration of an account, with their session and expiry; `sign_in_challenges`
the one open challenge of an account (the SHA-256 of its token, its `rememberMe`, its expiry and the
WebAuthn challenge of its latest options). `email_changes.session_id`,
`authenticator_app_setups.session_id` and `security_key_registrations.session_id` name a session of
the sessions module without a foreign key. Row-level
security applies to the tables with an `organization_id` (`cw-database-conventions`); none of these
has one, since the contracts give an account, its codes, its links and its lockout no organization
(`organizationId` is always `null` in `asyncapi/identity-service.yaml`). So they carry no policy and
nothing to force: the barrier is that every query names its account by id, or its address, or its
code by account and purpose, or its link by the hash of its token, and that a user reaches only the
account of its verified internal token. The application role `identity_app` reads and writes their
rows and runs no DDL on them.

Migration `0008_federated_sign_in.sql` creates the two global federated sign-in tables. The link
pins a verified provider identity to a local account. The flow stores state, browser and callback
receipt digests, a version and an indexed retention deadline. The repositories require a system
transaction and lock the flow before advancing its version or redeeming a receipt. A failed
transaction leaves the receipt available for its legitimate browser to retry. The provider calls,
federated session admission and expired-flow cleanup are wired separately.

The `account.deletion-sweep`, `account.delete` and `account.avatar-upload-expiry` queues live in
the `pgboss` schema of `@cadenway/nest-jobs`, provisioned by `src/migrate.ts`. The avatar sweep
has no payload.

## API

From `openapi/internal/identity-service.yaml` of the installed `@cadenway/contracts`. The account
routes below accept `api-gateway`.

| Route                                                           | Actor       | Success                      | Refusals                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /internal/v1/auth/sign-in-methods`                        | `anonymous` | 200                          | 400                                                                                                                                                                                                                 |
| `POST /internal/v1/auth/sign-up`                                | `anonymous` | 202                          | 400, 409 `auth.email-taken`, 422 terms or password, 429 `auth.code-throttled`                                                                                                                                       |
| `POST /internal/v1/auth/sign-up/code`                           | `anonymous` | 202                          | 400, 429 `auth.code-throttled`                                                                                                                                                                                      |
| `POST /internal/v1/auth/sign-up/verification`                   | `anonymous` | 200                          | 400, 422 `auth.code-invalid`, `auth.code-expired`, `auth.sign-up-replaced`                                                                                                                                          |
| `POST /internal/v1/auth/sign-in`                                | `anonymous` | 200, or 202 with a challenge | 400, 403 `auth.email-not-verified`, 422 `auth.invalid-credentials`, 429 `auth.account-locked`                                                                                                                       |
| `POST /internal/v1/auth/sign-in/code`                           | `anonymous` | 202                          | 400, 429 `auth.code-throttled`                                                                                                                                                                                      |
| `POST /internal/v1/auth/sign-in/code/verification`              | `anonymous` | 200, or 202 with a challenge | 400, 422 `auth.code-invalid`, `auth.code-expired`                                                                                                                                                                   |
| `POST /internal/v1/auth/sign-in/challenge/inspection`           | `anonymous` | 200                          | 400, 422 `auth.challenge-expired`                                                                                                                                                                                   |
| `POST /internal/v1/auth/sign-in/challenge/authenticator-app`    | `anonymous` | 200                          | 400, 422 `auth.challenge-expired`, `auth.two-step-code-invalid`, 429 `auth.two-step-locked`                                                                                                                         |
| `POST /internal/v1/auth/sign-in/challenge/backup-code`          | `anonymous` | 200                          | 400, 422 `auth.challenge-expired`, `auth.two-step-code-invalid`, 429 `auth.two-step-locked`                                                                                                                         |
| `POST /internal/v1/auth/sign-in/challenge/security-key/options` | `anonymous` | 200                          | 400, 422 `auth.challenge-expired`, `auth.security-key-refused`, 429 `auth.two-step-locked`                                                                                                                          |
| `POST /internal/v1/auth/sign-in/challenge/security-key`         | `anonymous` | 200                          | 400, 422 `auth.challenge-expired`, `auth.security-key-refused`, 429 `auth.two-step-locked`                                                                                                                          |
| `POST /internal/v1/auth/password-reset`                         | `anonymous` | 202                          | 400, 429 `auth.reset-throttled`                                                                                                                                                                                     |
| `POST /internal/v1/auth/password-reset/inspection`              | `anonymous` | 200                          | 400, 422 `auth.reset-link-expired`                                                                                                                                                                                  |
| `POST /internal/v1/auth/password-reset/confirmation`            | `anonymous` | 200                          | 400, 422 `auth.reset-link-expired`, `auth.password-too-short`, `auth.password-compromised`                                                                                                                          |
| `POST /internal/v1/sessions/{sessionId}/reauthentication`       | `user`      | 200                          | 400, 403 `auth.reauthentication-required`, 404 `session.not-found`, 409 `auth.two-step-not-enabled`, 422 `auth.password-incorrect`, `auth.two-step-code-invalid`, 429 `auth.account-locked`, `auth.two-step-locked` |
| `GET /internal/v1/users/{userId}`                               | `user`      | 200, `ETag`                  | 400, 404 `user.not-found`                                                                                                                                                                                           |
| `PATCH /internal/v1/users/{userId}`                             | `user`      | 200, `ETag`                  | 400, 404 `user.not-found`, 412 `request.version-mismatch`                                                                                                                                                           |
| `PUT /internal/v1/users/{userId}/password`                      | `user`      | 200, `ETag`                  | 400, 403 `auth.reauthentication-required`, 404 `user.not-found`, `session.not-found`, 422 password rules or `auth.password-incorrect`, 429 `auth.account-locked`                                                    |
| `POST /internal/v1/users/{userId}/email-change`                 | `user`      | 202                          | 400, 403 `auth.reauthentication-required`, 404, 409 `auth.email-taken`, 422 `auth.email-unchanged`, 429 `auth.code-throttled`                                                                                       |
| `POST /internal/v1/users/{userId}/email-change/confirmation`    | `user`      | 200, `ETag`                  | 400, 404, 409 `auth.email-taken`, 422 `auth.code-invalid`, `auth.code-expired`                                                                                                                                      |
| `POST /internal/v1/users/{userId}/deletion`                     | `user`      | 202, `deleteAt`              | 400, 403 `auth.reauthentication-required`, 404, 409 `account.organization-owner`                                                                                                                                    |
| `GET /internal/v1/users/{userId}/two-step-verification`         | `user`      | 200                          | 400, 404 `user.not-found`                                                                                                                                                                                           |
| `POST .../two-step-verification/disable`                        | `user`      | 204                          | 400, 403 `auth.reauthentication-required`, 404, 409 `auth.mfa-required-by-organization`                                                                                                                             |
| `POST .../two-step-verification/authenticator-app/setup`        | `user`      | 200                          | 400, 403 `auth.reauthentication-required`, 404                                                                                                                                                                      |
| `POST .../authenticator-app/setup/confirmation`                 | `user`      | 200                          | 400, 404, 422 `auth.two-step-setup-expired`, `auth.two-step-code-invalid`                                                                                                                                           |
| `POST .../two-step-verification/backup-codes/regenerate`        | `user`      | 200                          | 400, 403 `auth.reauthentication-required`, 404, 409 `auth.two-step-not-enabled`                                                                                                                                     |
| `POST .../two-step-verification/security-keys/registration`     | `user`      | 200                          | 400, 403 `auth.reauthentication-required`, 404, 409 `auth.two-step-not-enabled`, `auth.security-key-limit-reached`                                                                                                  |
| `POST .../two-step-verification/security-keys`                  | `user`      | 201, `Location`              | 400, 404, 409 `auth.two-step-not-enabled`, `auth.security-key-limit-reached`, 422 `auth.two-step-setup-expired`, `auth.security-key-refused`                                                                        |
| `POST .../security-keys/{securityKeyId}/remove`                 | `user`      | 204                          | 400, 403 `auth.reauthentication-required`, 404 `user.not-found`, `session.not-found`, `security-key.not-found`                                                                                                      |

Every route also answers the 401 and 403 of the internal token guard. A 429 carries `Retry-After`.
The sign-ins answer `deletionCancelled` in their `200`, and the answers of a challenge
`trustedDevice` when asked. `403 auth.reauthentication-required` carries `details.methods`:
`[password]` for an account without two-step verification, `[authenticator-app]` with it;
`409 account.organization-owner` and `409 auth.mfa-required-by-organization` carry
`details.organizationIds`, `422 auth.two-step-code-invalid` and `auth.security-key-refused`
`details.remainingAttempts` (`null` where nothing is counted), `429 auth.two-step-locked`
`details.lockedUntil` and `Retry-After`, `409 auth.security-key-limit-reached`
`details.maxSecurityKeys`. `...` stands for `/internal/v1/users/{userId}/two-step-verification`.

Notification delivery jobs call `GET /internal/v1/users/{userId}/notification-recipient` with a
`notification-service` system token that has no organization, role or scopes. The read returns only
the verified current email address, language, IANA time zone and account version from the same
account row. A missing, unverified or scheduled-for-deletion account returns `404 user.not-found`.
An account state the service cannot read returns `503 upstream.unavailable`. All responses carry
`Cache-Control: no-store`. The read appends no event.

The avatar routes are under `/internal/v1/users/{userId}`. The API gateway reserves an upload
with `POST /avatar/uploads`, reads its state with `GET /avatar/uploads/{uploadId}`, and sets or
clears the reference with `PUT /avatar` and `DELETE /avatar`. The first operation returns a 201
with a reservation location. The writes return 204 and the account ETag. The reservation state and
`GET /avatar-reference` return 200. A self request ignores the organization. To read another
account's opaque reference, the gateway first establishes current member visibility and supplies
the verified organization. Avatar responses are private.

## Events emitted

All appended to the outbox in the transaction of the use case, in a system transaction, with
`organizationId: null`.

| Event                                   | When                                                                                                           | Actor                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `user.signed-up.v1`                     | Each accepted sign-up, again with the next version                                                             | The user                                 |
| `user.email-verified.v1`                | The code of a sign-up is accepted                                                                              | The user                                 |
| `user.profile-updated.v1`               | A profile patch changed something                                                                              | The user                                 |
| `user.avatar-changed.v1`                | The account adopts, replaces or clears its opaque avatar reference                                             | The user                                 |
| `user.avatar-upload-abandoned.v1`       | The bounded expiry worker commits a terminal unused upload decision                                            | `system`, identity-service               |
| `user.password-changed.v1`              | A change (`method: change`) or a reset (`method: reset`) of the password                                       | The user                                 |
| `user.email-changed.v1`                 | The code of a change of address is accepted                                                                    | The user                                 |
| `user.deletion-scheduled.v1`            | The deletion of the account is scheduled                                                                       | The user                                 |
| `user.deletion-cancelled.v1`            | A sign-in of an account whose deletion is scheduled                                                            | The user                                 |
| `user.deleted.v1`                       | The durable job deletes the account at `deleteAt`                                                              | `system`, identity-service               |
| `one-time-code.issued.v1`               | A code is issued (sign-up, sign-up code, sign-in code, change of address)                                      | `system`; the user for an `email-change` |
| `password-reset-link.issued.v1`         | A reset link is issued to a verified account                                                                   | `system`, identity-service               |
| `user.two-step-verification-changed.v1` | Two-step verification turned on or off, its app replaced, its backup codes regenerated, a key added or removed | The user                                 |

The security events carry what their e-mail shows: the address and name of the account, its language
and time zone, and, where the contract says so, the device (read from the `User-Agent` by `bowser`)
and the address of the browser; never a password, a code, a token or a link, but the two restricted
ones. `session.revoked.v1` and `session.opened-on-new-device.v1`, which these flows cause, are
appended by the sessions module in the same transaction.

The avatar facts contain opaque account, asset and upload IDs only. The avatar generation
orders reference changes independently of the account version. Each expiry occurrence selects
up to 100 candidates and rechecks each reservation under its account lock before appending a
terminal fact in the same transaction. The account deletion fact lets Storage retire all of
the deleted account's reservations and images.

`user.two-step-verification-changed.v1` is appended once per change, with the next version of the
account and its `change` (`enabled`, `disabled`, `authenticator-app-replaced`,
`backup-codes-regenerated`, `security-key-added`, `security-key-removed`), the state after it
(`enabled`, the configured methods, the backup codes left), the key added or removed (id and name),
and the device and address of the browser for the security e-mail; never a secret, a code, a key or
a token. Using a backup code to sign in emits nothing: the sign-in is not a change of the
configuration.

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
  (without counting an attempt), for an account with two-step verification a recent proof of the
  session by a second factor (P2c-2), then the current one. It keeps every session open, records a
  recent authentication of the session of the request (a password one, none for an account with
  two-step verification, whose proof stays), ends the recent authentication of the others, and
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
  codes, reset links, pending change of address and two-step verification (app, backup codes, keys,
  pending setup and registration, challenge) by their foreign keys, its sessions with their address
  and `User-Agent`, its last organization choice, its trusted devices and its enrollment (the
  sessions module), its personal API
  tokens (the api-tokens module), and the throttles and lockout rows of its address. Kept: the copy
  of its memberships (ids and role), until the `member.removed.v1` organization-service emits on
  `user.deleted.v1` reaches it; the outbox rows of its past events, until their purge after 7 days
  (the restricted ones already redacted); the processed ids of the kit; the logs.
- "Nouvelle connexion": the password and the code sign-ins ask the sessions module to tell of a
  device the account did not use in the last 90 days; the sign-up verification, the first session of
  the account, asks for nothing.
- Two-step verification is on while the account has an authenticator app: turning it on confirms
  an app with one of its codes and draws 10 backup codes, returned once; it turns off by the
  disabling only, which deletes the app, the keys, the backup codes, the pending setup and
  registration and the open challenge, and forgets the trusted devices. Security keys need it on.
- A code of the app is 6 digits for a 30-second step (SHA-1, RFC 6238), accepted one step early or
  late, and once: its time step is recorded and a code of that step or an earlier one is refused,
  in the sign-in challenge as in the re-authentication.
- A backup code is `XXXX-XXXX` of digits and capital letters, typed with or without its dash, in
  any case, and works once.
- A right first factor of an account with two-step verification opens no session: it answers a
  challenge of 10 minutes, the one open challenge of the account (a newer sign-in replaces it),
  which keeps `rememberMe`; only its right answer opens the session, cancels a scheduled deletion
  and counts the device. A device the account trusts skips it.
- The wrong answers of the challenges and of the re-authentications by code of an account count
  together: `remainingAttempts` from 4 to 1, then the fifth locks them for 15 minutes, during which
  even a right answer is refused (`auth.two-step-locked`); a right answer resets the count. A
  wrong code of a setup is not counted. The lockout of the password stays per address.
- The WebAuthn options of a challenge last 5 minutes, the latest replacing the previous; an
  assertion verifies against them, the exact origin of `WEBAUTHN_ORIGINS` (no cross-origin answer,
  no `topOrigin`), the relying party `WEBAUTHN_RP_ID`, the signature, the counter, the key named by
  the answer among the keys of the account, and `userHandle`, when present, equal to the handle of
  the account. A credential id belongs to one account at most.
- For an account with two-step verification, the guarded routes require a recent proof by a second
  factor (`methods: [authenticator-app]`); a password never counts there, neither in the
  re-authentication (refused before it is checked or counted) nor in the change of password (whose
  current password is still required). The setup of an app, the start of a key registration, the
  regeneration of the backup codes, the removal of a key and the disabling require a recent
  authentication; the confirmation of a setup and the registration of a key ride on the one of their
  start.
- Turning two-step verification on ends the windows the other sessions opened with a password; a
  change of the password voids the open challenge and the pending setups and registrations of the
  other sessions, a reset those of every session, and both forget every trusted device, as the
  scheduling of the deletion does.
- The disabling is refused while an organization of the copy of the memberships requires two-step
  verification for the role of the person (`auth.mfa-required-by-organization`); already off, it
  answers `204` without a change.
- Never logged, never stored in clear by this module: a password, a code, a token, a reset link, the
  pepper, the secret of an app, a backup code, a WebAuthn answer or the token of a challenge or of a
  trusted device.

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
  password a second transaction locks the lockout row, then the account, and goes on only when the
  hash of the account is still the one checked (`settlePasswordCheck`): it then resets the count,
  opens the session, cancels a scheduled deletion and appends its event. A change, a reset or a new
  sign-up that commits during the check leaves the attempt counted and answers
  `auth.invalid-credentials`, so a session cannot be opened with a password that a reset has just
  replaced. Concurrent attempts of an address are counted one after the other, and the hash never
  holds a pooled connection. The code sign-in locks the account in its one transaction and does the
  same.
- Re-authentication and change of password: the same three steps around the hash (the change adds a
  first transaction that reads the account and the session, and the hash of the new password
  outside any transaction); the last transaction settles the check the same way (a password that
  moved answers `auth.password-incorrect`), records the recent authentication through the sessions
  module and, for a change, writes the hash, the account, the dropped change of address, the end of
  the recent authentication of the other sessions and the event together. For an account with
  two-step verification the last transaction checks again, under the lock of the account, that the
  session still has a recent proof by a second factor, and records none by password: two-step
  verification turned on, or the window ended, during the check of the hash answers
  `auth.reauthentication-required`.
- Two-step challenge: the sign-in transaction that checks the first factor replaces the challenge
  of the account (or, for a trusted device, opens the session). Each answer runs in one transaction:
  the challenge is found by the hash of its token, the account locked, the challenge read again
  `for update`, then the two-step verification locked; a wrong answer is committed with its count
  and then refused; a right one uses the challenge up (and the backup code, or records the time step
  of the code, or the counter and last use of the key), trusts the device when asked, opens the
  session, cancels a scheduled deletion and appends its events together. The options of a key lock
  the same rows and write the WebAuthn challenge of the challenge.
- Two-step verification: each route locks the account, checks the session through the sessions
  module, then locks the two-step verification; the confirmation of an app writes the app, the
  backup codes, the enrollment (sessions module), the end of the password windows of the other
  sessions, the recent authentication of the session, the account and the event together; the
  disabling deletes the factors, forgets the trusted devices and writes the enrollment, the account
  and the event together. The re-authentication by code runs in one transaction, its wrong code
  committed with its count.
- Lock order: the rows of an address (`sign_in_attempts`, `code_requests`,
  `password_reset_requests`) before the account of that address (a change of address locks the
  account, then the code row of the new address, which no verified account holds), the account before
  its two-step rows and its sessions and trusted devices: the lock of the account serializes every
  two-step write of the account, so the order of the rows locked after it is not relied on (an answer
  locks the challenge, then the two-step verification); and the open
  sessions of an account all at once in the order of their ids (sessions module). The reset
  confirmation and the completion of the deletion read the account first to learn its address, lock
  the rows of the address, then lock the account and check it again.
- Reset request: the throttle row of the address is locked and written, then the account of the
  address is locked, the previous link replaced, the new one stored and its restricted event
  appended, in one transaction; the token is drawn and the device read before it, whatever the
  address. The lock makes a confirmation of a change of address that commits meanwhile move the
  account away from the lookup, so no link reaches the previous mailbox.
- Reset confirmation: a first transaction reads the link; the new password is checked and hashed
  outside any transaction; the second locks the lockout row of the address, then the account, then
  the link, checks it again, and uses
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
  the rows of the address, then the account, checks again that its deletion is due and the
  ownership, and erases the account, appending `user.deleted.v1`, in one transaction
  (`tests/account-security.int-spec.ts` proves the rollback when that event cannot be written, and
  that a redelivered job does nothing). The sweep claims the 100 oldest due accounts that are not
  checked in the last hour: an account whose job is pending or dead-lettered is claimed again, its
  key deduplicated while pg-boss keeps the job, so 100 dead-lettered accounts would hold back the
  later ones until their jobs are purged (a day).

## Decisions

- The decisions of the walking skeleton are recorded in `docs/integration.md`; the code cites them
  by number. The decisions of P2c are those of its brief (password rules, reset link, change of
  password, recent authentication, change of address, deletion, security e-mails).
- The use cases run in the system transaction runner of the kit, a reviewed exception: the kit
  README reserves it for "work that crosses organizations or has none: outbox relay, schedules,
  events or routes without an organization", and also says "never use it to serve the request of a
  user". These routes and events have no organization, the tenant runner refuses to run without
  one, and the outbox policy accepts `organizationId: null` in a system transaction only. The
  exception is bounded: the system access touches the fourteen tables above, which carry no policy,
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
- Two-step verification (P2c-2) lives in this module: its factors are credentials of the account,
  the challenge replaces the end of a sign-in this module owns, and a deletion erases them by the
  foreign keys of `users`. What the sessions module needs (whether the account has it, the trusted
  devices, the policies) lives there and is written through its public operations in the
  transaction of the use case.
- Keys derived from `PASSWORD_PEPPER` with HKDF-SHA-256, each under its own label: the argon2
  secret, the code hashes, the sealing key of the secrets of the apps
  (`cadenway identity-service authenticator apps v1`) and the backup code hashes
  (`cadenway identity-service backup codes v1`). A secret of an app is sealed with AES-256-GCM, a
  nonce of 96 random bits per seal and the account id as associated data, so a sealed secret copied
  to another account does not open; it is stored as `k1.<nonce>.<ciphertext>.<tag>`, where `k1`
  names the key version.
- Rotating the sealing key would need: a new label (`... authenticator apps v2`) or a new secret
  for `k2`; an adapter that opens both `k1` and `k2` and seals with `k2`; a backfill that opens
  each `k1` secret and seals it again under `k2` in its own transaction; then, once no `k1` row is
  left, a release that drops `k1`. Rotating `PASSWORD_PEPPER` itself would also need the argon2
  hashes, the code hashes and the backup codes rehashed or regenerated, which this module cannot do
  without the person (a new pepper invalidates every password); it is not planned.
- A backup code is 8 symbols of 36 (digits and capital letters), about 41.4 bits (8 × log2 36), not
  the 80 bits an earlier note of the security skill gave. With 5 wrong answers per account before a
  15-minute lockout, shared with the codes of the app, an attacker who already has the password tries
  at most 480 codes a day against 10 valid ones out of 36^8 (about 2.8 × 10^12): less than one chance
  in 500 million a day. A code is stored as HMAC-SHA-256 under its own derived key, bound to the
  account, so a leaked table cannot be checked offline without the pepper.
- The lockout of the two-step answers is stored on `two_step_verifications` (`failed_answers`,
  `locked_until`), per account, not per challenge: a new challenge (a new sign-in with the
  password) does not reset it. The aggregate version of two-step verification is the version of the
  account (`users.version`), which every change takes; the two-step tables carry no version of
  their own.
- The WebAuthn handle of an account is 256 random bits, drawn when two-step verification turns on
  and kept when the app is replaced, unique across accounts; a key registered before a disabling is
  deleted with it, so a handle never outlives its keys.
- User verification is `preferred` and not required (`requireUserVerification: false`): the key is
  a second factor after the password. The origin is checked exactly against `WEBAUTHN_ORIGINS`
  before `@simplewebauthn/server` runs, which refuses a cross-origin answer or one with a
  `topOrigin` that the library alone would accept. `WEBAUTHN_RP_ID` is the host of the web
  application (`app.${DOMAIN}`, `app.cadenway.localhost` locally), which the configuration checks
  is the host of every origin or a parent of it.
- The disabling of an account already without two-step verification answers `204` before the
  policy and the recent authentication: there is nothing to protect, and the contract calls it a
  no-op. A setup started by a session can only be confirmed by that session.
- `tests/two-step-verification.int-spec.ts` proves, on real PostgreSQL and NATS, the setup and its
  confirmation, a sign-in answering 202 then 200 with a code of the app, a backup code working
  once, a trusted device skipping the challenge and forgotten after a change of the password, a
  security key registered and asserted with a software authenticator for the relying party
  `app.cadenway.localhost` and the origin `http://app.cadenway.localhost`, 5 wrong answers then
  429, the disabling refused under a policy, the organization withheld from a policy-bound member,
  one event per change, the rollback and redelivery, and no secret in the logs.
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
