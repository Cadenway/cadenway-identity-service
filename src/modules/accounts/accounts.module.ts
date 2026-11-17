import { Module } from '@nestjs/common';

import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { accountApiTokensProvider } from './composition/providers/adapters/accounts/account-api-tokens.provider.js';
import { accountDeletionSweepHandlerProvider } from './composition/providers/adapters/accounts/account-deletion-sweep-handler.provider.js';
import { accountSessionsProvider } from './composition/providers/adapters/accounts/account-sessions.provider.js';
import { accountsUnitOfWorkProvider } from './composition/providers/adapters/accounts/accounts-unit-of-work.provider.js';
import { clockProvider } from './composition/providers/adapters/accounts/clock.provider.js';
import { completeAccountDeletionHandlerProvider } from './composition/providers/adapters/accounts/complete-account-deletion-handler.provider.js';
import { compromisedPasswordsProvider } from './composition/providers/adapters/accounts/compromised-passwords.provider.js';
import { deviceReaderProvider } from './composition/providers/adapters/accounts/device-reader.provider.js';
import { oneTimeCodeSecretsProvider } from './composition/providers/adapters/accounts/one-time-code-secrets.provider.js';
import { ownedOrganizationsProvider } from './composition/providers/adapters/accounts/owned-organizations.provider.js';
import { passwordHasherProvider } from './composition/providers/adapters/accounts/password-hasher.provider.js';
import { resetLinkSecretsProvider } from './composition/providers/adapters/accounts/reset-link-secrets.provider.js';
import { sessionOpenerProvider } from './composition/providers/adapters/accounts/session-opener.provider.js';
import { changePasswordProvider } from './composition/providers/use-cases/accounts/change-password.provider.js';
import { completeAccountDeletionProvider } from './composition/providers/use-cases/accounts/complete-account-deletion.provider.js';
import { confirmEmailChangeProvider } from './composition/providers/use-cases/accounts/confirm-email-change.provider.js';
import { confirmPasswordResetProvider } from './composition/providers/use-cases/accounts/confirm-password-reset.provider.js';
import { discoverSignInMethodsProvider } from './composition/providers/use-cases/accounts/discover-sign-in-methods.provider.js';
import { enqueueDueAccountDeletionsProvider } from './composition/providers/use-cases/accounts/enqueue-due-account-deletions.provider.js';
import { getUserProvider } from './composition/providers/use-cases/accounts/get-user.provider.js';
import { inspectPasswordResetLinkProvider } from './composition/providers/use-cases/accounts/inspect-password-reset-link.provider.js';
import { reauthenticateProvider } from './composition/providers/use-cases/accounts/reauthenticate.provider.js';
import { requestEmailChangeProvider } from './composition/providers/use-cases/accounts/request-email-change.provider.js';
import { requestPasswordResetProvider } from './composition/providers/use-cases/accounts/request-password-reset.provider.js';
import { requestSignInCodeProvider } from './composition/providers/use-cases/accounts/request-sign-in-code.provider.js';
import { resendSignUpCodeProvider } from './composition/providers/use-cases/accounts/resend-sign-up-code.provider.js';
import { scheduleAccountDeletionProvider } from './composition/providers/use-cases/accounts/schedule-account-deletion.provider.js';
import { signInWithCodeProvider } from './composition/providers/use-cases/accounts/sign-in-with-code.provider.js';
import { signInWithPasswordProvider } from './composition/providers/use-cases/accounts/sign-in-with-password.provider.js';
import { signUpProvider } from './composition/providers/use-cases/accounts/sign-up.provider.js';
import { updateUserProfileProvider } from './composition/providers/use-cases/accounts/update-user-profile.provider.js';
import { verifySignUpProvider } from './composition/providers/use-cases/accounts/verify-sign-up.provider.js';
import { AccountSecurityController } from './presentation/http/controllers/accounts/account-security.controller.js';
import { UsersController } from './presentation/http/controllers/accounts/users.controller.js';
import { AuthController } from './presentation/http/controllers/authentication/auth.controller.js';
import { ReauthenticationController } from './presentation/http/controllers/authentication/reauthentication.controller.js';
import { PasswordResetController } from './presentation/http/controllers/password-reset/password-reset.controller.js';

/**
 * Class AccountsModule
 *
 * @description
 * Composition root of the accounts module: users, password credentials, one-time codes, password
 * reset links, pending changes of address, the throttles of the code and reset requests and the
 * password lockout, with the seven authentication flows, the reading and the profile of a user, the
 * security of the account (password change and reset, re-authentication, change of address,
 * scheduling of the deletion) and the durable jobs that complete the deletions (see its
 * `MODULE.md`). Use cases are plain classes built by the registered factories from their ports. The
 * pepper comes from the validated configuration (`CONFIG`); the sessions are reached through the
 * entry points `SessionsModule` exports, behind the `SessionOpener` and `AccountSessions` ports; the
 * personal API tokens through those of `ApiTokensModule` (`AccountApiTokens`); the copy of the
 * memberships through `FindOwnedOrganizations` of `MembershipsModule` (`OwnedOrganizations`). Every
 * one of them joins the system transaction of the use case. The job producer, scheduler and worker
 * registry come from the global `JobsRuntimeModule` of `src/app.module.ts`.
 */
@Module({
  imports: [SessionsModule, ApiTokensModule, MembershipsModule],
  controllers: [
    AuthController,
    PasswordResetController,
    ReauthenticationController,
    UsersController,
    AccountSecurityController,
  ],
  providers: [
    accountsUnitOfWorkProvider,
    passwordHasherProvider,
    oneTimeCodeSecretsProvider,
    compromisedPasswordsProvider,
    resetLinkSecretsProvider,
    deviceReaderProvider,
    sessionOpenerProvider,
    accountSessionsProvider,
    accountApiTokensProvider,
    ownedOrganizationsProvider,
    clockProvider,
    discoverSignInMethodsProvider,
    signUpProvider,
    resendSignUpCodeProvider,
    verifySignUpProvider,
    signInWithPasswordProvider,
    requestSignInCodeProvider,
    signInWithCodeProvider,
    getUserProvider,
    updateUserProfileProvider,
    reauthenticateProvider,
    changePasswordProvider,
    requestPasswordResetProvider,
    inspectPasswordResetLinkProvider,
    confirmPasswordResetProvider,
    requestEmailChangeProvider,
    confirmEmailChangeProvider,
    scheduleAccountDeletionProvider,
    enqueueDueAccountDeletionsProvider,
    completeAccountDeletionProvider,
    accountDeletionSweepHandlerProvider,
    completeAccountDeletionHandlerProvider,
  ],
})
export class AccountsModule {}
