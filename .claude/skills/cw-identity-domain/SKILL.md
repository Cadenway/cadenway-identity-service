---
name: cw-identity-domain
description: "The data, rules, events and screens cadenway-identity-service owns, taken from the mockup, the integration guide and the repositories document. Load it before naming, modeling or testing anything in this service."
---

# identity-service domain

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
- One-time codes expire (10 minutes for sign-in codes, 15 for an email change); their requests are throttled per address (30 s, 5 an hour), the email change included.
- Password reset links work once, for 30 minutes, from any browser; a new one voids the previous; their requests are throttled apart (45 s, 5 an hour); a reset never signs in and closes the other sessions unless unticked.
- A change of address, the scheduling of the deletion and the creation of a personal API token need a recent authentication of the session (10 minutes): the sign-in, a confirmed password or the current password of a change.
- The deletion of an account is scheduled 30 days ahead, refused to the owner of an organization, revokes every session and token at once, is cancelled by a sign-in, and is completed by a durable job that checks the ownership again.
- Recovery codes are shown once and stored hashed; API tokens are shown once.
- Sessions close after 12 hours of inactivity by default.

## Notes

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. Organizations and members belong to cadenway-organization-service from the start.

Decided: this service keeps a projection of memberships, fed by the `member.*` events, so that introspection returns the user, the organization and the member role. The authentication policies of an organization (required MFA, session lifetime, allowed sign-in methods) and its SAML connection are stored here, where they are enforced. The realtime gateway redeems its single-use connection ticket here. `user.profile-updated.v1` is in the contracts since `@cadenway/contracts` 0.5.0 and emitted on a profile change. Since 0.7.0 (P2c-1), the security of the account emits `user.password-changed.v1`, `user.email-changed.v1`, `user.deletion-scheduled.v1`, `user.deletion-cancelled.v1`, `user.deleted.v1` and `session.opened-on-new-device.v1`, each carrying what its security email shows, and the restricted `password-reset-link.issued.v1`, the only place the reset link exists in clear; the code of a change of address is a `one-time-code.issued.v1` of purpose `email-change`. Restricted subjects are readable by cadenway-notification-service only, and the code or link is never logged. The events of two-step verification come with P2c-2 and start in cadenway-api-contracts.

Everything above comes from the [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) and the
[integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et). When the mockup and this skill disagree, the mockup wins and
this skill is corrected in the same change.
