import { CONFIG } from '@cadenway/nest-common';
import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../../config/app-config.js';
import { SystemClock } from '../../infrastructure/system-clock.js';
import { OpenSession } from '../sessions/application/commands/open-session.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { AuthController } from './api/http/auth.controller.js';
import { UsersController } from './api/http/users.controller.js';
import { RequestSignInCode } from './application/commands/request-sign-in-code.js';
import { ResendSignUpCode } from './application/commands/resend-sign-up-code.js';
import { SignInWithCode } from './application/commands/sign-in-with-code.js';
import { SignInWithPassword } from './application/commands/sign-in-with-password.js';
import { SignUp } from './application/commands/sign-up.js';
import { VerifySignUp } from './application/commands/verify-sign-up.js';
import type { AccountsUnitOfWork } from './application/ports/accounts-unit-of-work.port.js';
import type { Clock } from './application/ports/clock.port.js';
import type { CompromisedPasswords } from './application/ports/compromised-passwords.port.js';
import type { OneTimeCodeSecrets } from './application/ports/one-time-code-secrets.port.js';
import type { PasswordHasher } from './application/ports/password-hasher.port.js';
import type {
  OpenedSession,
  SessionOpener,
  SessionRequest,
} from './application/ports/session-opener.port.js';
import { DiscoverSignInMethods } from './application/queries/discover-sign-in-methods.js';
import { GetUser } from './application/queries/get-user.js';
import { SystemAccountsUnitOfWork } from './infrastructure/persistence/system-accounts-unit-of-work.js';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher.js';
import { EmbeddedCompromisedPasswords } from './infrastructure/security/embedded-compromised-passwords.js';
import { HmacOneTimeCodeSecrets } from './infrastructure/security/hmac-one-time-code-secrets.js';

/**
 * Constant UNIT_OF_WORK
 *
 * @description
 * Token of the `AccountsUnitOfWork` port.
 *
 * @type {unique symbol}
 */
const UNIT_OF_WORK: unique symbol = Symbol('AccountsUnitOfWork');

/**
 * Constant PASSWORD_HASHER
 *
 * @description
 * Token of the `PasswordHasher` port.
 *
 * @type {unique symbol}
 */
const PASSWORD_HASHER: unique symbol = Symbol('PasswordHasher');

/**
 * Constant COMPROMISED_PASSWORDS
 *
 * @description
 * Token of the `CompromisedPasswords` port.
 *
 * @type {unique symbol}
 */
const COMPROMISED_PASSWORDS: unique symbol = Symbol('CompromisedPasswords');

/**
 * Constant CODE_SECRETS
 *
 * @description
 * Token of the `OneTimeCodeSecrets` port.
 *
 * @type {unique symbol}
 */
const CODE_SECRETS: unique symbol = Symbol('OneTimeCodeSecrets');

/**
 * Constant SESSION_OPENER
 *
 * @description
 * Token of the `SessionOpener` port.
 *
 * @type {unique symbol}
 */
const SESSION_OPENER: unique symbol = Symbol('SessionOpener');

/**
 * Constant CLOCK
 *
 * @description
 * Token of the `Clock` port.
 *
 * @type {unique symbol}
 */
const CLOCK: unique symbol = Symbol('AccountsClock');

/**
 * Class AccountsModule
 *
 * @description
 * Composition root of the accounts module: users, password credentials, one-time codes, the
 * throttle of the code requests and the password lockout, with the seven authentication flows and
 * `GET /internal/v1/users/{userId}` (see its `MODULE.md`). Use cases are plain classes built here
 * from their ports. The pepper comes from the validated configuration (`CONFIG`); the session of a
 * sign-in is opened by `OpenSession`, the entry point `SessionsModule` exports, behind the
 * `SessionOpener` port.
 */
@Module({
  imports: [SessionsModule],
  controllers: [AuthController, UsersController],
  providers: [
    {
      provide: UNIT_OF_WORK,
      inject: [SystemTransactionRunner, OutboxWriter, OutboxRelay],
      useFactory: (
        runner: SystemTransactionRunner,
        outbox: OutboxWriter,
        relay: OutboxRelay,
      ): AccountsUnitOfWork => new SystemAccountsUnitOfWork(runner, outbox, relay),
    },
    {
      provide: PASSWORD_HASHER,
      inject: [CONFIG],
      useFactory: (config: AppConfig): PasswordHasher =>
        new Argon2PasswordHasher(config.PASSWORD_PEPPER),
    },
    {
      provide: CODE_SECRETS,
      inject: [CONFIG],
      useFactory: (config: AppConfig): OneTimeCodeSecrets =>
        new HmacOneTimeCodeSecrets(config.PASSWORD_PEPPER),
    },
    {
      provide: COMPROMISED_PASSWORDS,
      useFactory: (): CompromisedPasswords => new EmbeddedCompromisedPasswords(),
    },
    {
      provide: SESSION_OPENER,
      inject: [OpenSession],
      useFactory: (openSession: OpenSession): SessionOpener => ({
        open: (request: SessionRequest): Promise<OpenedSession> => openSession.execute(request),
      }),
    },
    { provide: CLOCK, useFactory: (): Clock => new SystemClock() },
    {
      provide: DiscoverSignInMethods,
      useFactory: (): DiscoverSignInMethods => new DiscoverSignInMethods(),
    },
    {
      provide: SignUp,
      inject: [UNIT_OF_WORK, PASSWORD_HASHER, COMPROMISED_PASSWORDS, CODE_SECRETS, CLOCK],
      useFactory: (
        unitOfWork: AccountsUnitOfWork,
        hasher: PasswordHasher,
        compromised: CompromisedPasswords,
        secrets: OneTimeCodeSecrets,
        clock: Clock,
      ): SignUp => new SignUp(unitOfWork, hasher, compromised, secrets, clock),
    },
    {
      provide: ResendSignUpCode,
      inject: [UNIT_OF_WORK, CODE_SECRETS, CLOCK],
      useFactory: (
        unitOfWork: AccountsUnitOfWork,
        secrets: OneTimeCodeSecrets,
        clock: Clock,
      ): ResendSignUpCode => new ResendSignUpCode(unitOfWork, secrets, clock),
    },
    {
      provide: VerifySignUp,
      inject: [UNIT_OF_WORK, CODE_SECRETS, PASSWORD_HASHER, SESSION_OPENER, CLOCK],
      useFactory: (
        unitOfWork: AccountsUnitOfWork,
        secrets: OneTimeCodeSecrets,
        hasher: PasswordHasher,
        sessions: SessionOpener,
        clock: Clock,
      ): VerifySignUp => new VerifySignUp(unitOfWork, secrets, hasher, sessions, clock),
    },
    {
      provide: SignInWithPassword,
      inject: [UNIT_OF_WORK, PASSWORD_HASHER, SESSION_OPENER, CLOCK],
      useFactory: (
        unitOfWork: AccountsUnitOfWork,
        hasher: PasswordHasher,
        sessions: SessionOpener,
        clock: Clock,
      ): SignInWithPassword => new SignInWithPassword(unitOfWork, hasher, sessions, clock),
    },
    {
      provide: RequestSignInCode,
      inject: [UNIT_OF_WORK, CODE_SECRETS, CLOCK],
      useFactory: (
        unitOfWork: AccountsUnitOfWork,
        secrets: OneTimeCodeSecrets,
        clock: Clock,
      ): RequestSignInCode => new RequestSignInCode(unitOfWork, secrets, clock),
    },
    {
      provide: SignInWithCode,
      inject: [UNIT_OF_WORK, CODE_SECRETS, SESSION_OPENER, CLOCK],
      useFactory: (
        unitOfWork: AccountsUnitOfWork,
        secrets: OneTimeCodeSecrets,
        sessions: SessionOpener,
        clock: Clock,
      ): SignInWithCode => new SignInWithCode(unitOfWork, secrets, sessions, clock),
    },
    {
      provide: GetUser,
      inject: [UNIT_OF_WORK],
      useFactory: (unitOfWork: AccountsUnitOfWork): GetUser => new GetUser(unitOfWork),
    },
  ],
})
export class AccountsModule {}
