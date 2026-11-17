---
name: cw-identity-domain
description: "The data, rules, events and screens cadenway-identity-service owns, taken from the mockup, the integration guide and the repositories document. Load it before naming, modeling or testing anything in this service."
---

# identity-service domain

## What this service owns

Who the user is and how they sign in.

**Data**: Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status).

**API**: Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.

**Events emitted**: `user.signed-up.v1`, `user.email-verified.v1`, `user.profile-updated.v1`, `session.revoked.v1` and the restricted `one-time-code.issued.v1`, from `asyncapi/identity-service.yaml`. Planned, not in the contracts yet: `user.status-changed`, `api-token.created`, `api-token.revoked`.

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

Decided: this service keeps a projection of memberships, fed by the `member.*` events, so that introspection returns the user, the organization and the member role. The authentication policies of an organization (required MFA, session lifetime, allowed sign-in methods) and its SAML connection are stored here, where they are enforced. The realtime gateway redeems its single-use connection ticket here. `user.profile-updated.v1` is in the contracts since `@cadenway/contracts` 0.5.0 and emitted on a profile change; `user.deleted` is still to be added in cadenway-api-contracts before it is coded. The security emails (sign-in code, reset link, password changed, new sign-in, MFA enabled, account deletion) are triggered by a dedicated family of events of this service; an event carries the single-use, short-lived code or link when the email needs one. Their NATS subjects are readable by cadenway-notification-service only, and the code or link is never logged. These events are to be added in cadenway-api-contracts before they are coded.

Everything above comes from the [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) and the
[integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et). When the mockup and this skill disagree, the mockup wins and
this skill is corrected in the same change.
