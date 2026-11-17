# cadenway-identity-service

cadenway-identity-service owns who the user is and how they sign in. NestJS, its own PostgreSQL database (one database with a migrator role and an application role in the shared PostgreSQL of the VPS), events over NATS JetStream through `@cadenway/nest-messaging`, internal REST for the API gateway. Local port 3010.

|            |                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data       | Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status).                                                                       |
| API        | Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.                                                                                                                                                                                                                                 |
| Emits      | `user.signed-up.v1`, `user.email-verified.v1`, `user.profile-updated.v1`, `session.revoked.v1` and the restricted `one-time-code.issued.v1`, from `asyncapi/identity-service.yaml`. Planned, not in the contracts yet: `user.status-changed`, `api-token.created`, `api-token.revoked`                                                                                                   |
| Listens to | `member.joined.v1`, `member.role-changed.v1` and `member.removed.v1` of `asyncapi/organization-service.yaml`, for its copy of the memberships: the choice of the current organization of a session and the organization and role of both introspections. A removal ends the organization of the member's sessions there and makes its personal API tokens of that organization inactive. |
| External   | OAuth providers, customers' SAML identity providers, WebAuthn for security keys.                                                                                                                                                                                                                                                                                                         |
| Phase      | First version                                                                                                                                                                                                                                                                                                                                                                            |

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. Organizations and members belong to cadenway-organization-service from the start.

## Getting started

Requirements: Node.js LTS and pnpm (versions in `package.json`), and Docker.

1. Clone this repository next to the other Cadenway repositories, flat, in one folder.
2. To run it with the rest of Cadenway, start the stack from `cadenway-ops`; it builds the sibling
   folders, this one included (see its `docs/development.md`):

   ```bash
   cd ../cadenway-ops/compose
   cp .env.example .env                        # once
   docker compose run --rm internal-token-keys # once: the key pairs of the internal token
   docker compose up -d
   ```

3. To work on this repository alone, against its own PostgreSQL and NATS:

   ```bash
   pnpm install
   cp .env.example .env                        # once
   docker compose -f compose.dev.yaml up -d --wait
   pnpm migration:run                          # as identity_migrator; again after a pull that adds one
   pnpm start:dev                              # http://localhost:3010/health/ready
   ```

The configuration is validated at start-up; [development](../docs/development.md) lists the
variables and explains how to call the service locally with an internal token.

## Checks

Run the narrowest check first; CI runs them all on every pull request.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test src/modules/<module>      # targeted
pnpm test:integration                    # PostgreSQL and NATS in Docker
pnpm test:coverage
pnpm build
docker compose -f compose.dev.yaml config -q
```

## Contributing

- [Contributing guide](CONTRIBUTING.md): branches, commits, pull requests, releases.
- [Code of conduct](CODE_OF_CONDUCT.md), [security policy](SECURITY.md), [getting help](SUPPORT.md).
- AI assistants follow [AGENTS.md](../AGENTS.md); Claude Code also reads [CLAUDE.md](../CLAUDE.md) and the
  tooling described in [.claude/README.md](../.claude/README.md).

## License

This repository is proprietary. See [LICENSE](../LICENSE) for the rights and restrictions that apply.

## References

- [Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE): every screen, state and interaction.
- [Integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et): tokens, data shapes, component names.
- [Repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N): what each repository owns, deployment.
