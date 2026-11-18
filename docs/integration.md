# Domain and integration

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

**Status:** This page records the target design from repository instructions and skills. Its behavior has not been verified as implemented in this snapshot.

The tables and rules on this page are **target domain behavior**, not proof of a running service or an approved API. Source: `cw-identity-domain` ([Claude](../.claude/skills/cw-identity-domain/SKILL.md), [Codex](../.codex/skills/cw-identity-domain/SKILL.md)). The linked mockup and guides remain the source for product details; confirm ambiguous values before implementation.

## What this service owns

Who the user is and how they sign in.

**Data**: Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status).

**API**: Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.

**Events emitted**: `user.signed-up.v1`, `user.email-verified.v1`, `user.profile-updated.v1`, `user.password-changed.v1`, `user.email-changed.v1`, `user.deletion-scheduled.v1`, `user.deletion-cancelled.v1`, `user.deleted.v1`, `user.two-step-verification-changed.v1`, `session.revoked.v1`, `session.opened-on-new-device.v1` and the restricted `one-time-code.issued.v1` and `password-reset-link.issued.v1`, from `asyncapi/identity-service.yaml`. Planned, not in the contracts yet: `user.status-changed`, `api-token.created`, `api-token.revoked`.

**Events consumed**: `member.joined.v1`, `member.role-changed.v1` and `member.removed.v1` of `asyncapi/organization-service.yaml`, for the copy of the memberships (module `memberships`). The choice of the current organization of a session checks it, and both introspections fill the organization and the role from it. A removal ends the organization of the member's sessions there, for good (a person who joins again gets a new membership and chooses the organization again), and makes its personal API tokens of that organization inactive.

**External systems**: OAuth providers, customers' SAML identity providers, WebAuthn for security keys.

**Mockup screens**: Main, Inscription, Mfa, Otp, MotDePasseOublie, Reinitialisation, Deconnexion; Compte › Profil, Sécurité, Préférences, Jetons d’API; Organisation › Sécurité et SSO.

## Rules this service guards

- Passwords: 12 characters minimum, no composition rule, refused when found in the embedded list of compromised passwords; strength scored 0 to 4. This decision overrides the mockup, whose password screens still list composition rules.
- Lockout after repeated failures (the mockup shows 15 minutes and "3 tentatives restantes").
- One-time codes expire (10 minutes for sign-in codes, 15 for an email change); resend is throttled (30 s and 45 s in the mockup).
- Recovery codes are shown once and stored hashed; API tokens are shown once.
- Sessions close after 12 hours of inactivity by default.

## Notes

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. Organizations and members belong to cadenway-organization-service from the start.

Decided: this service keeps a projection of memberships, fed by the `member.*` events, so that introspection returns the user, the organization and the member role. The authentication policies of an organization (required MFA, session lifetime, allowed sign-in methods) and its SAML connection are stored here, where they are enforced. The realtime gateway redeems its single-use connection ticket here. `user.profile-updated.v1` is in the contracts since `@cadenway/contracts` 0.5.0 and emitted on a profile change. Since `@cadenway/contracts` 0.7.0 (P2c-1), the security of the account emits `user.password-changed.v1`, `user.email-changed.v1`, `user.deletion-scheduled.v1`, `user.deletion-cancelled.v1`, `user.deleted.v1` and `session.opened-on-new-device.v1`, which carry what their security email shows, and the restricted `password-reset-link.issued.v1`, which carries the single-use reset link; the code of a change of address travels in the restricted `one-time-code.issued.v1` (purpose `email-change`). The restricted subjects are readable by cadenway-notification-service only, and the code or link is never logged. The two-step verification events come with P2c-2.

Everything above comes from the [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) and the
[integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et). If the mockup disagrees with this guide, update the guide and its source skill for both assistants.

## Decisions of the walking skeleton

The first slice of authentication (sign-up, verification by code, sign-in by password or by email
code, introspection, sign-out, current user) was built on these decisions. The code and the
`MODULE.md` files cite them by number; the user may revise them, through the contracts first when a
contract states the rule.

1. The address of a sign-up is confirmed with the 6-digit code of the Otp screen, valid 10 minutes,
   not with the link of the email artboard of the mockup.
2. Five consecutive failed password sign-ins of an address lock its password sign-in for 15
   minutes; `details.remainingAttempts` counts down to 1 (the "Il vous reste 3 tentatives" of the
   mockup after two failures); a success resets the count.
3. Without "Rester connecté pendant 30 jours" the cookie has no `Max-Age` and the session ends after
   12 hours of inactivity; with it, `Max-Age` and an absolute lifetime of 30 days. The contract
   (`openapi/public/auth.yaml`) applies the 12 hours to persistent sessions too and requires a bound
   for both: this service gives both the same 30 days.
4. Passwords: 12 characters minimum, no composition rule, argon2id (m = 19 456 KiB, t = 2, p = 1)
   through `crypto.argon2` with the pepper of `PASSWORD_PEPPER`; a short repository-authored list of
   obviously weak passwords stands in for the list of compromised passwords, whose provenance is
   open.
5. Unverified accounts are not purged.
6. Login CSRF belongs to the gateway: an exact allowed `Origin` and `Content-Type: application/json`
   on every unsafe public auth route.
7. The gateway maps each error `code` to the French `title` of the public problem; this service
   answers the English reason phrases.
8. Codes are never logged, never stored in clear (a keyed hash is), and leave this service only in
   the restricted `one-time-code.issued.v1`.

Decisions of this service, taken while building it:

- A code stops working after five wrong attempts ("a few" in the contract).
- One code request every 30 seconds per address whatever the purpose, and at most 5 in an hour per
  address (security review: without a cap, successive codes allow about 14 400 guesses a day at a
  6-digit code). The cap answers `auth.code-throttled` too. `CodeThrottled` of the contracts states
  both since `@cadenway/contracts` 0.4.0.
- A password attempt is counted as a failure before its hash is checked, so the hash runs outside
  any transaction while concurrent attempts are all counted; a right password clears the count.
- The verification of a sign-up is bound to the password of the latest sign-up of the address
  (security review of the walking skeleton, then `@cadenway/contracts` 0.4.0): a repeated sign-up of
  an unverified address replaces its name and password, so without the binding someone could sign
  up a pending address again with a password of their own and let its owner verify it. The code is
  checked first; with the right code, a different `password`, or none once the address was signed
  up more than once, answers `auth.sign-up-replaced` and uses the code up; an address signed up once
  is still verified by its code alone. The count of accepted sign-ups is stored on the account
  (`users.sign_up_count`).
- The activity of a session is recorded at most once a minute.
- The flows run in the system transaction runner, since they and their events have no organization
  (see the `MODULE.md` of the accounts module).

## Decisions of the organization context (P2b)

The organization context, the personal API tokens and the profile follow the decisions of the P2b
plan, which the `MODULE.md` files of the sessions, memberships, api-tokens and accounts modules
cite:

1. A session acts on at most one organization, chosen with
   `PUT /internal/v1/sessions/{sessionId}/organization` and checked against the copy of the
   memberships; a membership not there yet answers `404 organization.not-found` and the web
   application retries. The session keeps the membership it acts through: a removal ends its
   organization for good, even if the person joins again.
2. A new session starts in the organization the account last chose, when it is still a member
   there, else in none.
3. The copy of the memberships follows `member.joined.v1`, `member.role-changed.v1` and
   `member.removed.v1` from the start of the stream, by version, a removed membership staying
   removed; beyond the seven days of `EVENTS` it is rebuilt by organization-service (see the
   `MODULE.md` of the memberships module). A member event that fails is redelivered for about 25
   hours before its dead letter (P2b security follow-ups, decision 3), so that a removal outlasts
   an outage of the database.
4. A personal API token belongs to its user and to the current organization of the session that
   created it; it works while neither revoked nor expired and while its user is a member of that
   organization; its last use is recorded at most once a minute.
5. A session holds every scope: `tasks:read`, `tasks:write`, `members:read`, `webhooks:manage`.
6. The profile changes by a JSON Merge Patch, emits `user.profile-updated.v1` when something moved,
   and takes `Europe/Paris` as the time zone of an account that never chose one.

## Engineering standards

These skills fix the engineering standards this service follows. They are target conventions, not proof of an implementation in this snapshot.

| Skill                                                                                                                                                | What it fixes                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cw-database-conventions` ([Claude](../.claude/skills/cw-database-conventions/SKILL.md), [Codex](../.codex/skills/cw-database-conventions/SKILL.md)) | Plural snake_case tables, `id` from `uuidv7()`, `organization_id` first in tenant indexes, `version`, `timestamptz` dates, `text` with `CHECK` for enumerations, forced row-level security, a pool of 5 connections, timeouts per role. |
| `cw-logging-and-tracing` ([Claude](../.claude/skills/cw-logging-and-tracing/SKILL.md), [Codex](../.codex/skills/cw-logging-and-tracing/SKILL.md))    | JSON logs with fixed fields and masking, W3C `traceparent` over HTTP and NATS, the ESM start-up flags, metrics per route and lag alerts, health and shutdown semantics.                                                                 |
| `cw-jobs` ([Claude](../.claude/skills/cw-jobs/SKILL.md), [Codex](../.codex/skills/cw-jobs/SKILL.md))                                                 | Durable jobs on pg-boss through `@cadenway/nest-jobs`: enqueued in the use case transaction, one key per occurrence, bounded retries, a dead-letter queue.                                                                              |
| `cw-identity-security` ([Claude](../.claude/skills/cw-identity-security/SKILL.md), [Codex](../.codex/skills/cw-identity-security/SKILL.md))          | Opaque sessions, API and internal token formats, argon2id parameters and the password policy, TOTP, WebAuthn, the hardened SAML profile, lockout and code lifetimes.                                                                    |

## Contract and delivery sequence

The `cadenway-api-contracts` repository owns HTTP and event specifications. Consumers use published `@cadenway/contracts` packages and `@cadenway/nest-messaging`; do not redefine payloads or connect to another service's database. Change contracts first, then the producing service, followed by gateways and listeners, and finally the webapp. Planned event names on this page must be checked against the actual published specification before use.

## References

[Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Use [AGENTS.md](../AGENTS.md) as the local source for ownership and hard limits.
