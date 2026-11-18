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
- **API token**: `cw_pat_`, then 30 base62 characters drawn one by one with `crypto.randomInt`
  (no modulo bias), then 6 base62 characters of the CRC32 (`zlib.crc32`) of those 30, zeros first.
  Shown once, by its creation; only its SHA-256 hash and its first 11 characters (`prefix`) are
  stored. The check characters let a malformed or truncated token be refused without a query; they
  are no security. Bound to its user and to the current organization of the session that created
  it, with an expiry of 30 days (default), 90 days, 1 year or none; active while neither revoked nor
  expired and while its user is a member of its organization in the copy of the memberships.
  `POST /internal/v1/api-tokens/introspect` is checked at every request, without a cache; its last
  use is recorded at most once a minute.
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
  from the keys of the code hashes, of the sealing of the authenticator apps and of the backup codes. The stored PHC string holds the parameters and the salt, never
  the pepper. The password is normalized to NFC before hashing. Without an account, a sign-in still
  checks a decoy hash, so its time does not tell.
- The hash is checked outside any transaction: the attempt is first counted as a failure in a
  transaction that locks the lockout row, and a right password clears the count afterwards, so a
  flood of sign-ins never holds the connections of the pool.
- This policy was decided after the mockup was drawn: the password screens of the mockup still list
  composition rules and are to be corrected.

## Second factors

- **TOTP** (`otplib`, RFC 6238): SHA-1, 6 digits, 30-second steps, `epochTolerance: 30` (one step
  either way); the last accepted time step is stored and passed as `afterTimeStep`, so a code works
  once, in the sign-in challenge as in the re-authentication. The secret is 160 random bits in
  base32, sealed at rest with AES-256-GCM under a key derived from the pepper by HKDF-SHA-256 under
  its own label, a 96-bit nonce per seal and the account id as associated data, stored as
  `k1.<nonce>.<ciphertext>.<tag>`: `k1` is the key version, so a later key opens the old rows while
  a backfill seals them again (the accounts `MODULE.md` says what a rotation needs). A setup lasts
  15 minutes and belongs to the session that started it.
- **Security keys** (`@simplewebauthn/server`): `residentKey: 'preferred'`, user verification
  `preferred` and not required (a second factor after the password), attestation `none`, ES256,
  EdDSA and RS256; transports and flags of each credential are stored, so passkeys can be enabled
  later without a migration. The relying party is `WEBAUTHN_RP_ID`, the host of the web application
  (`app.${DOMAIN}`, `app.cadenway.localhost` locally); `clientDataJSON.origin` is compared exactly
  with `WEBAUTHN_ORIGINS`, and a cross-origin answer or one with a `topOrigin` is refused before the
  library runs. A credential id belongs to one account; `userHandle`, when present, must be the
  handle of the account (256 random bits, kept while two-step verification stays on). Options last
  5 minutes; 10 keys at most per account.
- **Backup codes**: 10 codes `XXXX-XXXX` of digits and capital letters drawn with
  `crypto.randomInt`, typed with or without the dash, in any case; 8 symbols of 36 give about
  41.4 bits each (8 × log2 36), not 80. That suffices because they are a second factor behind the
  password and share the lockout of the answers: 5 wrong answers per account, then 15 minutes, so at
  most 480 guesses a day against 10 codes out of 36^8, under one chance in 500 million a day. Stored
  as HMAC-SHA-256 under their own key derived from the pepper, bound to the account; single use;
  shown once, at the enabling and at each regeneration.
- **Two-step challenge**: the right first factor of an account with two-step verification answers
  `202` with a challenge token of 256 random bits (only its SHA-256 is stored), valid 10 minutes,
  one open per account; its answer opens the session. The wrong answers of the challenges and of
  the re-authentications by code count per account: `remainingAttempts` from 4 to 1, then the
  fifth locks them 15 minutes (`auth.two-step-locked`), the right one included.
- **Trusted device**: `trustDevice` makes the browser skip the challenge for 30 days with a token of
  256 random bits in the cookie `__Host-cw_trusted_device`, only its SHA-256 stored; a change or a
  reset of the password, "Déconnecter les autres", the disabling and the deletion forget every
  device of the account.
- **Recent authentication with two-step verification**: only a proof by a second factor counts (the
  code of the app, or the answer of a challenge); a password is refused without being checked or
  counted (`details.methods: [authenticator-app]`).

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
- Sign-up verification: bound to the password of the latest sign-up of the address
  (`@cadenway/contracts` 0.4.0). The code is checked first, so a wrong or unusable code answers as
  before whatever `password` holds; with the right code, a `password` that differs from the one of
  the latest sign-up, or no `password` once a later accepted sign-up replaced the pending account
  (`users.sign_up_count` above 1), answers `auth.sign-up-replaced` and uses the code up. The hash is
  checked outside any transaction, between a first transaction that uses the code and a second that
  verifies the account if its version did not move. Without it, signing up someone else's pending
  address again would let its owner verify a password chosen by another person.
- Resend: one code request every 30 seconds per address whatever the purpose, sign-ups and the
  change of address (counted on the new address) included, account or not, and 5 at most per
  address in an hour, so successive codes cannot be guessed at length (5 codes of 5 attempts, 25
  guesses an hour at most).
- Password reset link (`@cadenway/contracts` 0.7.0): a token of 256 random bits in base64url, which
  travels only in the restricted `password-reset-link.issued.v1` and after `#token=` in the link;
  only its SHA-256 is stored. It works once, for 30 minutes, from any browser; a newer link of the
  account, and a change of address, void it. Requests of an address are throttled apart from the
  codes: 45 seconds and 5 in an hour, account or not, with the same answer whatever the account. A
  reset ends the lockout of the address, drops a pending change of address, closes every session
  unless unticked (and ends their recent authentication otherwise), keeps the API tokens and never
  signs in.
- Recent authentication: a session records when its person last proved who they are (the sign-in,
  a confirmed password or code, the current password of a change, the answer of a challenge); the
  change of address, the scheduling of the deletion, the creation of a personal API token, the
  changes of two-step verification and of an authentication policy require it within 10 minutes
  (`403 auth.reauthentication-required`). The failed passwords of the re-authentication and of the
  change count with the failed sign-ins of the address of the account.

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
- The pepper has no rotation: changing it makes every stored password, pending code, backup code
  and sealed secret of an app unusable. The sealing key of the apps alone can rotate through its key
  version.
