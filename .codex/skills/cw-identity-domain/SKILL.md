---
name: cw-identity-domain
description: "The data, rules, events and screens cadenway-identity-service owns, taken from the mockup, the integration guide and the repositories document. Load it before naming, modeling or testing anything in this service."
---

# identity-service domain

## What this service owns

Who the user is and how they sign in.

**Data**: Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status).

**API**: Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.

**Events emitted**: `user.signed-up`, `user.email-verified`, `user.status-changed`, `session.revoked`, `api-token.created`, `api-token.revoked`.

**Events consumed**: `member.removed` (closes the user's sessions in that organization).

**External systems**: OAuth providers, customers' SAML identity providers, WebAuthn for security keys.

**Mockup screens**: Main, Inscription, Mfa, Otp, MotDePasseOublie, Reinitialisation, Deconnexion; Compte › Profil, Sécurité, Préférences, Jetons d’API; Organisation › Sécurité et SSO.

## Rules this service guards

- Passwords: 12 characters minimum, no composition rule, refused when found in the embedded list of compromised passwords; strength scored 0 to 4. This decision overrides the mockup, whose password screens still list composition rules.
- Lockout after repeated failures (the mockup shows 15 minutes and "3 tentatives restantes").
- One-time codes expire (10 minutes for sign-in codes, 15 for an email change); resend is throttled (30 s and 45 s in the mockup).
- Recovery codes are shown once and stored hashed; API tokens are shown once.
- Sessions close after 12 hours of inactivity by default.

## Notes

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. At start-up this service also carries the organizations and members module, extracted later into cadenway-organization-service.

Everything above comes from the [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) and the
[integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et). When the mockup and this skill disagree, the mockup wins and
this skill is corrected in the same change.
