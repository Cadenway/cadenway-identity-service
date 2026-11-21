# Sessions

## Purpose

The sign-in sessions of the browsers:

- the opening of a session once the accounts module has verified a sign-in: an opaque token of 256
  random bits, returned once, of which only the SHA-256 is stored;
- the introspection the API gateway calls on every request that carries the session cookie;
- the issuance and single-use redemption of short-lived realtime tickets for a selected
  organization;
- the revocation of a session (the sign-out), of every other session ("Déconnecter les autres"),
  and of the sessions a password reset or the scheduling of a deletion closes;
- the list of the open sessions of a person ("Sessions actives");
- the browser of each session: address and `User-Agent`, from which `bowser` reads the device of
  the list and of "Nouvelle connexion" (`session.opened-on-new-device.v1`, a device the account did
  not use in the last 90 days);
- the recent authentication of each session (decision 4 of P2c): when its person last proved who
  they are, which the change of address, the scheduling of the deletion and the creation of a
  personal API token require within 10 minutes;
- the current organization of a session (P2b plan, decision 2): its choice, the last organization
  each account chose, where its next sessions start, and the organization, the role and the scopes
  of the introspection;
- how each recent authentication was made (`password` or `two-step`) and which accounts have
  two-step verification (`two_step_enrollments`, written by the accounts module in its
  transaction), since a password never counts as recent for an account with it (P2c-2);
- the trusted devices of the two-step verification (decision 7 of P2c, "Faire confiance à cet
  appareil pendant 30 jours"): a browser that answered a challenge with `trustDevice` skips the
  challenge of the sign-ins of its account for 30 days, until a change or a reset of the password,
  "Déconnecter les autres", the disabling of two-step verification or the deletion forgets it;
- the authentication policy of each organization (decision 8 of P2c, Organisation › Sécurité et
  SSO): who must have two-step verification (`nobody`, `admins`, `everyone`) and after how long
  without activity a session acting on it ends (1 hour, 12 hours, 7 days or 30 days); both
  introspections withhold the organization from a member the policy requires two-step
  verification of, who has none.

It does not own accounts, passwords, codes or the factors of two-step verification (the accounts
module), nor the cookies, which the API gateway sets from the tokens, nor the memberships, which it
reads through the `FindActiveMembership` and `FindUserMemberships` providers of the memberships
module behind its own `ActiveMemberships` port, and through `FindOrganizationMember` and
`ListOrganizationMembers` behind its `OrganizationMembers` port. The realtime ticket access
port uses `LockActiveMembership` to hold the active membership in the ticket transaction.

## Public entry points

| Entry point                                                | Consumers            |
| ---------------------------------------------------------- | -------------------- |
| `sessions.module`                                          | accounts, api-tokens |
| `public/session/open-session`                              | accounts             |
| `public/session/check-session-authentication`              | accounts             |
| `public/session/authenticate-session`                      | accounts             |
| `public/session/end-recent-authentication`                 | accounts             |
| `public/session/revoke-user-sessions`                      | accounts             |
| `public/session/count-open-sessions`                       | accounts             |
| `public/session/erase-user-sessions`                       | accounts             |
| `public/session/check-organization-session-authentication` | api-tokens           |
| `public/session/record-two-step-verification`              | accounts             |
| `public/trusted-device/trust-device`                       | accounts             |
| `public/trusted-device/check-trusted-device`               | accounts             |
| `public/trusted-device/forget-trusted-devices`             | accounts             |
| `public/authentication-policy/find-two-step-requirements`  | accounts             |
| `public/authentication-policy/check-organization-access`   | api-tokens           |

`SessionsModule` exports the providers `OpenSession`, `CheckSessionAuthentication`,
`AuthenticateSession`, `EndRecentAuthentication`, `RevokeUserSessions`, `CountOpenSessions`,
`EraseUserSessions` and `CheckOrganizationSessionAuthentication`, each with its input and output
types. Accounts binds the first to its session opener port and the next six to its
`AccountSessions` port; they run in the system runner and join the system transaction of the
accounts use case that calls them. Api-tokens binds the last to its `RecentAuthentications` port; it
runs in the tenant runner and joins the tenant transaction of the creation of a token.

For two-step verification (P2c-2), `SessionsModule` also exports `RecordTwoStepVerification`,
which accounts binds to its `TwoStepEnrollments` port; `TrustDevice`, `CheckTrustedDevice` and
`ForgetTrustedDevices`, bound to its `TrustedDevices` port; and `FindTwoStepRequirements`, bound
to its `TwoStepRequirements` port. All five run in the system runner and join the system
transaction of the accounts use case that calls them. Api-tokens binds `CheckOrganizationAccess`
to its `OrganizationAccess` port; it joins the system transaction of the introspection of a
personal API token. `AuthenticateSession` takes the method of the recent authentication and
`EndRecentAuthentication` its scope (every window, or the windows of a password);
`CheckSessionAuthentication` and `CheckOrganizationSessionAuthentication` say whether the account
has two-step verification.

## Owned tables

| Table                     | Key                       | Organization scoping                                        |
| ------------------------- | ------------------------- | ----------------------------------------------------------- |
| `sessions`                | `id`, unique `token_hash` | `organization_id`, the current one or `null`; policy forced |
| `organization_choices`    | `user_id`                 | `organization_id`, the last one chosen; policy forced       |
| `trusted_devices`         | `id`, unique `token_hash` | none: a device of an account                                |
| `two_step_enrollments`    | `user_id`                 | none: a fact of an account                                  |
| `authentication_policies` | `organization_id`         | `organization_id`, tenant table; policy forced              |
| `realtime_tickets`        | `token_hash`              | `organization_id`, bound to the session; policy forced      |

`sessions` was created by `migrations/0001_accounts_and_sessions.sql`; its `organization_id` and
`member_id` (the membership it acts through, both `null` together) and `organization_choices` by
`migrations/0003_organization_context_and_api_tokens.sql`, which forces the policy of the kit on
both, as on every `organization_id`. `user_id` names an account of the accounts module and
`member_id` a membership of the memberships module, without a foreign key: a module never
references the tables of another. A session and a choice belong to an account, not to the
organization they name: every query names its row by id, token hash or account, and a user reaches
only its own sessions. `signed_in_at` (the sign-in, to the millisecond, the order and the cursor of
the list) and `authenticated_at` (the recent authentication) come from
`migrations/0004_account_security.sql`; the list reads through the index on `user_id`. `browser`,
`operating_system` and `device_type` keep labels for the record only; the device shown is read from
`user_agent`.

`migrations/0005_two_step_verification.sql` adds `sessions.two_step_authenticated_at`, the instant
of `authenticated_at` when a second factor opened that window, `null` otherwise and for the rows
written before it, and creates `trusted_devices` (the SHA-256 of the token
of the cookie `__Host-cw_trusted_device`, its expiry, read by token hash and pruned by account
through the index on `user_id`), `two_step_enrollments` (one row per account with two-step
verification) and `authentication_policies` (one row per organization whose policy was locked,
the default row inserted by the first lock; none reads as `nobody`
and 720 minutes), whose forced policy the migration writes by hand, as for
every `organization_id`. `user_id` names an account and `organization_id` an organization of
another service, without a foreign key.

`migrations/0006_realtime_tickets.sql` creates `realtime_tickets`. It stores the ticket digest,
the session version, the account, the selected organization and membership, and the issuance,
expiry and redemption times. Deleting a session also deletes its tickets.

## API

From `openapi/internal/identity-service.yaml` of the installed `@cadenway/contracts`; issuer
`api-gateway` only, no organization (one the internal token carries is ignored).

| Route                                                   | Actor    | Success                     | Refusals                                                        |
| ------------------------------------------------------- | -------- | --------------------------- | --------------------------------------------------------------- |
| `POST /internal/v1/tokens/introspect`                   | `system` | 200, `active` true or false | 400, 503 if the configured membership authority is unavailable  |
| `DELETE /internal/v1/sessions/{sessionId}`              | `user`   | 204                         | 400, 404 `session.not-found`                                    |
| `PUT /internal/v1/sessions/{sessionId}/organization`    | `user`   | 200, organization and role  | 400, 404 `session.not-found`, 404 `organization.not-found`      |
| `POST /internal/v1/sessions/{sessionId}/revoke-others`  | `user`   | 200, `revokedCount`         | 400, 404 `session.not-found`                                    |
| `GET /internal/v1/users/{userId}/sessions`              | `user`   | 200, one page               | 400, 404 `user.not-found`, 404 `session.not-found`              |
| `GET /internal/v1/organization/authentication-policy`   | `user`   | 200, policy and `ETag`      | 403 `organization.role-forbidden`, 404 `organization.not-found` |
| `PATCH /internal/v1/organization/authentication-policy` | `user`   | 200, policy and `ETag`      | 400, 403, 404, 409 `auth.two-step-not-enabled`, 412             |

`POST /internal/v1/sessions/{sessionId}/reauthentication` is served by the accounts module, which
owns the password, the authenticator app and their lockouts, and records the recent authentication
through `AuthenticateSession`.

The two routes of the authentication policy require the organization of the internal token, the
current one of the session, and run in its tenant transaction; only its owner and its admins read
or change it (`organization.role-forbidden`). `PATCH` is a JSON Merge Patch with `If-Match`
(`412 request.version-mismatch` with the current version), refused when it would require two-step
verification for the role of the actor, who has none (`409 auth.two-step-not-enabled`), and
without a recent authentication of the session that counts for the actor
(`403 auth.reauthentication-required` with `details.methods`). `PUT .../organization` also answers
`403 organization.mfa-required` with `details.organizationId` when the policy of the organization
requires two-step verification for the role of the person, who has none; the introspection of a
session acting on such an organization answers `withheldOrganization` with no organization.

Every route also answers the 401 and 403 of the internal token guard.

The realtime ticket operations are registered as private Sessions providers. Their HTTP entry
points depend on the published P4 Identity contract.

## Events emitted

| Event                             | When                                                                        | Actor                   |
| --------------------------------- | --------------------------------------------------------------------------- | ----------------------- |
| `session.revoked.v1`              | An active session is revoked: sign-out, revocation, others, reset, deletion | The user of the session |
| `session.organization-changed.v1` | A selection changes the organization or membership, including the first one | The user of the session |
| `session.opened-on-new-device.v1` | A sign-in opens a session on a device unused by the account for 90 days     | The user                |

`session.revoked.v1` is appended to the outbox in the transaction of the revocation, with the version of the
session after the revocation (one more than its last choice of an organization) and
`organizationId: null`, which `asyncapi/identity-service.yaml` still fixes ("always `null` in this
version") although a session now names its current organization. A session that only expires, or
one revoked again, emits nothing.

`session.organization-changed.v1` carries the persisted session version, the session and
account IDs, and `organizationId: null`. The payload omits both organizations, the membership and
the ticket. The realtime gateway uses the version to invalidate sockets with an older session
version. Selecting the same membership or recording activity emits nothing. The outbox relay
retries publication with the same event ID, and repeated or older deliveries cannot invalidate a
newer socket.

`session.opened-on-new-device.v1` is appended by `OpenSession`, in the transaction of the sign-in,
when the sign-in asks for it (`newDeviceNotice`: the password and the code sign-ins, never the
sign-up verification, the first session of the account) and no session of the account active in
the 90 days before has the same type, browser and operating system, read from its `User-Agent`
(`isNewDevice`). It carries the version of the new session (1), the device and the address of the
browser, and the address, name, language and time zone of the account, which the accounts module
passes in; never the token nor the `User-Agent`.

## Events consumed

None directly. A `member.removed.v1` reaches the sessions through the copy of the memberships (the
memberships module). The copy serves organization selection and the introspection during rollout.
When configured, introspection confirms the role and the membership directly with Organization
even if removal or role changes have yet to reach the copy. An unavailable proof returns
`503 organization.unavailable`; the credential and its local selection are unchanged.

The change of an authentication policy, the trust and the forgetting of a device emit nothing: the
contract declares no event for them. `user.two-step-verification-changed.v1` belongs to the
accounts module.

## Invariants

- A session ends at `expiresAt`, 30 days after the sign-in, whatever its activity; the cookie lasts
  until then with "Rester connecté pendant 30 jours", until the browser closes without it.
- Either session also ends after 12 hours without activity, as `openapi/public/auth.yaml` states for
  both, or after the inactivity timeout of the policy of its current organization (1 hour,
  12 hours, 7 days or 30 days); an active introspection is activity, recorded at most once a minute.
  Choosing an organization whose timeout the session already exceeded closes it, without an event,
  and answers `session.not-found`.
- A malformed, unknown, expired, inactive or revoked token introspects as `active: false`; so
  does a personal API token, introspected by its own route.
- A session acts on at most one organization, through a membership of its account in the copy of
  the memberships. Choosing it needs that membership to be active (`organization.not-found`
  otherwise, also for the few seconds before `member.joined.v1` arrives); choosing the current one
  again answers 200 and leaves the session as it is; any other choice takes the next version of the
  session; every choice becomes the last choice of the account.
- The introspection answers the organization and the role of the membership the session chose
  while that very membership is active, `null` for both otherwise: a removal ends the organization
  of the member's sessions there for good, and a person invited again chooses it again. A session
  holds every scope (`tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`).
- A new session starts in the last organization its account chose when the account still has an
  active membership there, else in none.
- A revoked session never becomes active again; revoking an ended session answers 204 and emits
  nothing; a session of another user answers like an unknown id.
- A realtime ticket can be redeemed once within 60 seconds and before the session ends. The
  session version and the active membership must still match at redemption. The stored digest
  resolves the ticket without carrying the credential into persistence.
- The token is never logged, never stored, never in an event; the address and the `User-Agent` are
  never logged with it.
- A session records its recent authentication at the sign-in that opens it, and again when its
  person confirms the password or changes it from this session; a change of the password ends it
  in the other open sessions, a reset in all of them. It is recent for 10 minutes; it is not a
  change of version.
- The list holds the open sessions of the actor, the most recent sign-in first, then by id, with
  `current` for the session of the request, which must be one of them; another account answers
  `user.not-found`.
- "Déconnecter les autres" revokes every open session of the actor but the one of the request,
  which must be open; it says how many. It also closes, without an event and without counting
  them, the sessions already idle beyond the inactivity of their organization, as a reset and the
  scheduling of the deletion do: a later, longer inactivity of a policy then cannot bring back a
  session the person ended.
- Two devices are the same for "Nouvelle connexion" when their type, browser and operating system
  are, whatever their versions and addresses.
- For an account with two-step verification, only a recent authentication by a second factor
  (`two_step_authenticated_at = authenticated_at`) is recent; turning it on ends the windows the other
  sessions opened with a password, a change of the password ends every window but the one of the
  request, a reset every window.
- A trusted device lasts 30 days from the answer that trusted it; its token is 256 random bits,
  returned once, of which only the SHA-256 is stored; a change or a reset of the password,
  "Déconnecter les autres" (the device of the request included), the disabling of two-step
  verification and the deletion of the account forget every device of the account; an account
  keeps the 10 devices it trusted last.
- A policy that requires two-step verification for a role withholds its organization from the
  members of that role without it: the introspection of their sessions and of their personal API
  tokens answers `withheldOrganization`, for a session with no organization and no role, for a
  token with no scope (its organization and role kept), and the choice of it answers
  `organization.mfa-required`. Their membership stays; turning two-step verification on
  ends the withholding at the next introspection.
- Nobody saves a policy that would withhold their own organization from themselves, and the policy
  of an organization with no row is `nobody` and 720 minutes; each saved change takes the next
  version of the policy, and a patch that moves nothing keeps it.

## Transactions

`SystemSessionsUnitOfWork` runs each use case in one system transaction (see Decisions).
`OpenSession` runs inside the transaction of the sign-in of the accounts module and joins it, so a
session exists only if the sign-in commits (`tests/auth-flows.int-spec.ts` proves the rollback); it
reads the last choice of the account and the copy of the memberships in that transaction. The
revocation locks the session row, writes it and appends its event together. The choice of an
organization locks the session, reads the copy of the memberships, and writes the session and the
last choice together with the outbox row when the session changes
(`tests/organization-context.int-spec.ts` proves the rollback). The
introspection writes the last activity only when it moved by a minute, without a lock: a concurrent
later write wins. With a live authority, the HTTP lookup happens between local transactions.
The second transaction reloads the session, validates it, and applies the local MFA policy to the
proven role. A concurrent change of selection withholds the organization for that response and
the next introspection starts from the new selection.

The operations of the accounts module (`CheckSessionAuthentication`, `AuthenticateSession`,
`EndRecentAuthentication`, `RevokeUserSessions`, `CountOpenSessions`, `EraseUserSessions`) join the
system transaction of their caller: a change of password, a reset, a change of address, the
scheduling and the completion of a deletion commit with their effects on the sessions, and their
events, or not at all. They lock the sessions they write; every operation that locks several
sessions of an account (`AuthenticateSession`, `EndRecentAuthentication`, `RevokeUserSessions`,
"Déconnecter les autres") locks all its open sessions at once, in the order of their ids, and then
works on that set, so two of them never wait on each other in a cycle
(`tests/account-security.int-spec.ts` signs the others out from two devices at once). The list
reads in one system transaction. `CheckOrganizationSessionAuthentication` runs in
`TenantSessionsUnitOfWork`, joins the tenant transaction of the creation of a personal API token
and locks the session it checks: the scheduling of the deletion locks the open sessions before it
revokes the tokens, so it either waits for that token and revokes it, or revokes the session first
and the creation finds it ended.

`RecordTwoStepVerification`, `TrustDevice`, `CheckTrustedDevice`, `ForgetTrustedDevices` and
`FindTwoStepRequirements` join the system transaction of the accounts use case that calls them: a
challenge answered, two-step verification turned on or off, a password changed or reset commit
with their trusted devices and their enrollment, or not at all. `UpdateAuthenticationPolicy` runs
in the tenant transaction of the organization of the token: it reads the role of the actor in the
copy of the memberships, locks the policy (inserting the default row first when the organization
has none, so two first changes serialize), checks the enrollment of the actor, then locks the
session of the request, which must act on that organization, and saves the policy with the next
version. `GetAuthenticationPolicy` reads in the tenant transaction; the counts of the members
without two-step verification read the active memberships of the organization and their
enrollments in two queries. The introspection reads the inactivity of the policy of the current
organization with the session, in the same query, then, for a session acting through an active
membership, the policy and the enrollment of the account by their keys, for the withholding.

`SystemRealtimeTicketsUnitOfWork` opens one system transaction for issuance or redemption. The
authorization lookup locks policy, membership and any required enrollment first. The use case
then locks the session and, for redemption, the ticket before rechecking their binding.

The `session.realtime-ticket-expiry` job runs every minute in UTC without a payload or tenant
context. It fixes the cutoff at the start of the attempt and deletes up to 100 expired tickets
per system transaction through the expiry index. It skips locked rows and checks cancellation
before each batch. Redemption enforces expiry separately. The next sweep picks up any still
expired rows after a skipped or failed attempt. After two retries, inspect recurring dead letters
in `session.realtime-ticket-expiry.dead-letter` and verify that subsequent sweeps resume.

## Decisions

- The decisions of the walking skeleton are recorded in `docs/integration.md`.
- The system transaction runner serves these routes, the same reviewed exception as in the accounts
  module: the kit README reserves it for "routes without an organization" and also says "never use
  it to serve the request of a user". The exception is bounded to the rows each query names: a
  session by id or token hash, a last choice by account (both tables carry the forced policy of
  their `organization_id`, which the system access lifts for these rows only), the copy of the
  memberships read by organization and account through `FindActiveMembership`, and outbox inserts
  with `organizationId: null`. The choice of an organization takes the organization from the body,
  as the contract states, and only after the copy of the memberships confirmed the actor belongs to
  it.
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
  gets a new membership and chooses the organization again, as the contract states ("A session
  whose organization was emptied by a removal stays without one, even after the person joins the
  organization again with a new membership, until an organization is chosen again"); a new session
  starts there anyway, since the last choice keeps the organization ("a new session starts in the
  last organization the person chose, if they are a member of it").
- The last choice of an account lives in `organization_choices`, one row per account, rather than
  being derived from its sessions, which a future purge of ended sessions would lose.
- Choosing the current organization again leaves the session as it is but records it as the last
  choice of the account, as the contract states ("records the organization as the last choice of
  the actor again, the one their next sessions start in, also when another session of theirs chose
  another organization since"): a person who chose another organization in another browser and
  comes back to this one starts there next time.
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
- The check of the recent authentication of the creation of a personal API token runs in the tenant
  runner, not the system one: that request carries an organization, and the kit refuses a system
  transaction inside the tenant one of the creation. The forced policy of `sessions` then shows the
  session only while it acts on the organization of the internal token, which the gateway took from
  the introspection of that very session; a session that chose another organization since answers
  `session.not-found`, which the gateway answers as `401 auth.session-expired`. The check and the
  creation commit together.
- The device of the list is read from the stored `User-Agent` at each reading, not from the labels
  stored at the sign-in, so that every session, older ones included, shows the shape of the
  contract (`Device`); a page holds 100 sessions at most. The version of Windows and macOS is
  `null`, which a `User-Agent` does not tell reliably.
- "Nouvelle connexion" reads the distinct `User-Agent` of the sessions of the account active in the
  last 90 days (by `last_active_at`, revoked and expired ones included), the 100 used last at most,
  and compares their devices in the use case: the header comes from the browser, so without the
  bound an account signing in with ever new ones would make each of its sign-ins read and parse more
  of them in its transaction. Detection by type, browser and operating system is the rule of the contract; the
  device cookie of P2c-2 refines it. The first session of an account, opened by the sign-up
  verification, tells nobody.
- `signed_in_at` is a column of its own, written by the service to the millisecond, rather than
  `created_at`, which PostgreSQL writes to the microsecond: the cursor of the list holds the
  instant as `toISOString` gives it and compares it exactly. Migration 0004 backfills it from
  `created_at` for the sessions not revoked or expired, the only ones listed; its default covers
  the rows the previous version inserts during a rollout.
- No index orders the list: inspected on 405,000 sessions (an account with 5,000, most of them
  revoked), an index on `(user_id, signed_in_at, id)` still read every session of the account and
  ran slower than the index on `user_id` (0.9 ms against 0.4 ms), since revoked and idle sessions
  dominate; every sign-in would have paid for it. The work grows with the sessions an account ever
  opened until closed sessions are purged.
- The trusted devices, the enrollments and the policies live here rather than in the accounts
  module (P2c-2): the introspection, the choice of an organization and "Déconnecter les autres" use
  them, and the sessions module cannot depend on the accounts module, which already depends on it.
  The accounts module writes them through public operations that join its transaction;
  `two_step_enrollments` is the one fact of two-step verification the sessions need, so the
  factors themselves stay in the accounts module.
- The inactivity timeout of a session follows the policy of the organization its row names
  (`organization_id`), read in the query that finds the session (a correlated subquery, without a
  join that `FOR UPDATE` would refuse), whatever the state of its membership: a removed member's
  session still ends with that organization's timeout until it chooses another. The contract says
  720 minutes for a session without an organization; this stricter reading is an open point for
  cadenway-api-contracts, since honoring the membership there would make the session query read
  the copy of the memberships, a table of another module.
- A window counts as a second factor only while `two_step_authenticated_at` equals
  `authenticated_at`, rather than through a method column: the previous release, running beside
  this one during a rollout, records a password window by writing `authenticated_at` alone, which
  ends the match, so it can never extend a second-factor proof; the rows written before 0005 have
  no `two_step_authenticated_at` and count as a password (no account had two-step verification).
  While that previous release still runs, it serves the sign-ins of accounts with two-step
  verification with the password alone and does not withhold organizations: those sessions are not
  revoked by the roll-forward.
- `TrustDevice` deletes the expired devices of the account in the same transaction, and the oldest
  beyond the 10 it keeps, so a browser that trusts itself again and again does not make the rows
  grow; a forgotten device is deleted at once.
- A policy change that moves nothing answers the same version, but still requires a recent
  authentication: the check order of the contract puts the recent authentication before the write.
  Its lock inserts the default row when the organization has none, which then stays.
- The check of the enrollment of the actor by a policy change and the policies read by the disabling
  of the same person in another browser take no common lock: both can commit at once and withhold the
  organization from that person. It is recoverable, the routes of the account staying served, and
  accepted rather than serializing every disabling behind the policies of the organizations.
- Inactivity is computed at each reading from the current policy, not stored: lengthening it makes
  a session idle under the previous value active again, as the contract states that the sessions
  follow the new policy from the next introspection; the revocations close idle sessions so that
  this never brings back one the person ended.
- `PUT .../organization` checks the membership before the policy, so a non-member never learns the
  policy of an organization; it closes a session idle beyond the timeout of the chosen organization,
  without `session.revoked.v1`, since the contract says a session closing for inactivity emits
  nothing.
- The counts of members without two-step verification grow with the members of the organization
  (two queries, then a count in the use case); the policy screen is read by owners and admins only.
- `tests/two-step-verification.int-spec.ts` proves, on real PostgreSQL and NATS, the policy change,
  the withheld organization of a member in both introspections, the trusted device skipping the
  challenge and forgotten after a change of the password, and the windows by method.
- `tests/account-security.int-spec.ts` proves the list (device, address, current, order, cursor,
  another account, an ended session of the request), "Déconnecter les autres", the windows of
  recent authentication, and "Nouvelle connexion" (first session, known device, new device, a
  device unused for 90 days) on real PostgreSQL and NATS.
- `tests/auth-flows.int-spec.ts` proves the introspection of an active, idle and revoked session,
  the revocation and its event, on real PostgreSQL and NATS; `tests/organization-context.int-spec.ts`
  the choice of an organization (member, non-member, removed, not there yet), the introspection with
  and without an organization, a new session starting in the last organization chosen, and a
  removal emptying the organization of the sessions.
