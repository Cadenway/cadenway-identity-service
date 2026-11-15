---
name: cw-identity-security
description: "The security parameters cadenway-identity-service applies: sessions and tokens, argon2id and the password policy, TOTP, WebAuthn, the hardened SAML profile, lockout and code lifetimes. Load it before writing or reviewing anything that hashes, signs, verifies or issues a credential."
---

# identity-service security

The identity service is built in NestJS, with no external identity provider. `cw-identity-domain`
lists what the service owns; this skill fixes **how** each credential is produced, stored and
verified. A value below is changed here first, then in code.

## Sessions and tokens

- **Session**: an opaque token of 256 random bits; only its SHA-256 hash is stored. The API gateway
  carries it in the cookie `__Host-cw_session; HttpOnly; Secure; SameSite=Lax`.
- **Verification**: the gateway calls `POST /internal/v1/tokens/introspect` at every request; there
  is no cache, so a revoked session stops at the next request.
- **Inactivity**: 12 hours by default, adjustable per organization, for persistent sessions too
  (`openapi/public/auth.yaml`); an active introspection is activity, recorded at most once a minute.
- **Lifetime**: 30 days after the sign-in at the latest. With "Rester connecté pendant 30 jours" the
  cookie has `Max-Age` up to then; without it the cookie ends with the browser and the session keeps
  the same 30-day bound.
- **API token**: `cw_pat_`, then 30 base62 characters, then 6 characters of CRC32 check. Stored as a
  SHA-256 hash, with an expiry, shown once.
- **Internal token**: a JWT signed with `alg: Ed25519`, valid 60 seconds, with `aud` set to the
  called service and a `kid`. It carries the user, the organization, the role, the scopes and the
  trace. Signing and verification live in `@cadenway/nest-common`.
- **Device of a session**: read from the User-Agent with `bowser`. A User-Agent cannot tell
  Windows 11 from Windows 10; the web app sends `navigator.userAgentData` where the browser has it.

## Passwords

- 12 characters minimum and **no composition rule**; a password found in the embedded list of
  compromised passwords is refused. The provenance of that list is still to be chosen.
- Hashing: argon2id with m = 19 456 KiB, t = 2, p = 1, through `crypto.argon2` of Node; no
  third-party binary. The pepper (`PASSWORD_PEPPER`, 32 characters at least) is kept outside the
  database; the secret key of argon2id is derived from it by HKDF-SHA-256 under its own label, apart
  from the key of the code hashes. The stored PHC string holds the parameters and the salt, never
  the pepper. The password is normalized to NFC before hashing. Without an account, a sign-in still
  checks a decoy hash, so its time does not tell.
- The hash is checked outside any transaction: the attempt is first counted as a failure in a
  transaction that locks the lockout row, and a right password clears the count afterwards, so a
  flood of sign-ins never holds the connections of the pool.
- This policy was decided after the mockup was drawn: the password screens of the mockup still list
  composition rules and are to be corrected.

## Second factors

- **TOTP** (`otplib`): `epochTolerance: 30`; the last accepted time step is stored and passed as
  `afterTimeStep`, so a code cannot be replayed. The secret is encrypted at rest.
- **Security keys** (`@simplewebauthn/server`): `residentKey: 'preferred'`; transports and flags of
  each credential are stored, so passkeys can be enabled later without a migration.
- **Recovery codes**: 80 bits each, stored as HMAC-SHA-256, single use, shown once.

## Single sign-on

- **OIDC** (`openid-client`): Google, Microsoft, GitLab, GitHub and enterprise OIDC.
- **SAML 2.0** (`@node-saml/node-saml`), hardened profile. The library defaults are `never` and
  `sha1`; set every value explicitly:
  - `validateInResponseTo: 'always'` and `rejectReplayedAssertions: true`, with the request and
    assertion cache in PostgreSQL;
  - `sha256` for signatures and digests;
  - 60 seconds of accepted clock skew, assertions valid 5 minutes at most;
  - IdP-initiated sign-in is off.
- Secrets of third parties (an OIDC client secret, for example) are encrypted with AES-256-GCM; the
  key is kept outside the database.

## Lockout and one-time codes

- Lockout: five consecutive failed password sign-ins of an address, account or not, lock its
  password sign-in for 15 minutes; `remainingAttempts` counts down from 4 to 1 (the mockup's "Il vous
  reste 3 tentatives" after two failures); a success, or the end of the lockout, resets the count. A
  sign-in by email code is not locked.
- One-time codes: 6 digits from `crypto.randomInt`; sign-up and sign-in codes expire after 10
  minutes, email-change codes after 15; single use; a newer code of the same account and purpose
  replaces the previous one; the fifth wrong attempt stops a code. Stored as HMAC-SHA-256 under a
  key derived from the pepper by HKDF, bound to the account and the purpose; the digits leave the
  service only in the restricted `one-time-code.issued.v1`.
- Resend: one code request every 30 seconds per address whatever the purpose, sign-ups included,
  account or not (45 s for an email change in the mockup, when it exists), and 5 at most per address
  in an hour, so successive codes cannot be guessed at length (5 codes of 5 attempts, 25 guesses an
  hour at most).

## Primitives

- Hashes, HMAC, random tokens and encryption come from `node:crypto`, with no third-party package.
- Never log a credential, a code or a token, even hashed (`cw-logging-and-tracing`).

## Open points

- The public routes for OIDC callbacks, the SAML assertion consumer service and the SAML metadata
  are not in the contracts yet: they start in cadenway-api-contracts.
- `crypto.argon2` is documented as stable since Node 24.7.0; the specs of
  `Argon2PasswordHasher` run it on Node 24.18.
- The provenance of the full list of compromised passwords: a short repository-authored list stands
  in for it behind the `CompromisedPasswords` port.
- The pepper has no rotation: changing it makes every stored password and pending code unusable.
