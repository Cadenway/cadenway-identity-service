import { Module } from '@nestjs/common';

import { SessionsModule } from '../sessions/sessions.module.js';
import { accountsUnitOfWorkProvider } from './composition/providers/adapters/accounts/accounts-unit-of-work.provider.js';
import { clockProvider } from './composition/providers/adapters/accounts/clock.provider.js';
import { compromisedPasswordsProvider } from './composition/providers/adapters/accounts/compromised-passwords.provider.js';
import { oneTimeCodeSecretsProvider } from './composition/providers/adapters/accounts/one-time-code-secrets.provider.js';
import { passwordHasherProvider } from './composition/providers/adapters/accounts/password-hasher.provider.js';
import { sessionOpenerProvider } from './composition/providers/adapters/accounts/session-opener.provider.js';
import { discoverSignInMethodsProvider } from './composition/providers/use-cases/accounts/discover-sign-in-methods.provider.js';
import { getUserProvider } from './composition/providers/use-cases/accounts/get-user.provider.js';
import { requestSignInCodeProvider } from './composition/providers/use-cases/accounts/request-sign-in-code.provider.js';
import { resendSignUpCodeProvider } from './composition/providers/use-cases/accounts/resend-sign-up-code.provider.js';
import { signInWithCodeProvider } from './composition/providers/use-cases/accounts/sign-in-with-code.provider.js';
import { signInWithPasswordProvider } from './composition/providers/use-cases/accounts/sign-in-with-password.provider.js';
import { signUpProvider } from './composition/providers/use-cases/accounts/sign-up.provider.js';
import { verifySignUpProvider } from './composition/providers/use-cases/accounts/verify-sign-up.provider.js';
import { UsersController } from './presentation/http/controllers/accounts/users.controller.js';
import { AuthController } from './presentation/http/controllers/authentication/auth.controller.js';

/**
 * Class AccountsModule
 *
 * @description
 * Composition root of the accounts module: users, password credentials, one-time codes, the
 * throttle of the code requests and the password lockout, with the seven authentication flows and
 * `GET /internal/v1/users/{userId}` (see its `MODULE.md`). Use cases are plain classes built by the registered factories
 * from their ports. The pepper comes from the validated configuration (`CONFIG`); the session of a
 * sign-in is opened by `OpenSession`, the entry point `SessionsModule` exports, behind the
 * `SessionOpener` port.
 */
@Module({
  imports: [SessionsModule],
  controllers: [AuthController, UsersController],
  providers: [
    accountsUnitOfWorkProvider,
    passwordHasherProvider,
    oneTimeCodeSecretsProvider,
    compromisedPasswordsProvider,
    sessionOpenerProvider,
    clockProvider,
    discoverSignInMethodsProvider,
    signUpProvider,
    resendSignUpCodeProvider,
    verifySignUpProvider,
    signInWithPasswordProvider,
    requestSignInCodeProvider,
    signInWithCodeProvider,
    getUserProvider,
  ],
})
export class AccountsModule {}
