import { Module } from '@nestjs/common';
import { sessionsUnitOfWorkProvider } from './composition/providers/adapters/session/sessions-unit-of-work.provider.js';
import { sessionTokensProvider } from './composition/providers/adapters/session/session-tokens.provider.js';
import { deviceReaderProvider } from './composition/providers/adapters/session/device-reader.provider.js';
import { sessionClockProvider } from './composition/providers/adapters/session/clock.provider.js';
import { openSessionProvider } from './composition/providers/use-cases/session/open-session.provider.js';
import { introspectTokenProvider } from './composition/providers/use-cases/session/introspect-token.provider.js';
import { revokeSessionProvider } from './composition/providers/use-cases/session/revoke-session.provider.js';
import { SessionsController } from './presentation/http/controllers/session/sessions.controller.js';
import { TokensController } from './presentation/http/controllers/token/tokens.controller.js';
import { OpenSession } from './public/session/open-session.js';

/**
 * Class SessionsModule
 *
 * @description
 * Registers the sessions HTTP controllers and operation factories. Accounts receives the
 * same OpenSession provider that joins the system transaction of a verified sign-in.
 */
@Module({
  controllers: [TokensController, SessionsController],
  providers: [
    sessionsUnitOfWorkProvider,
    sessionTokensProvider,
    deviceReaderProvider,
    sessionClockProvider,
    openSessionProvider,
    introspectTokenProvider,
    revokeSessionProvider,
  ],
  exports: [OpenSession],
})
export class SessionsModule {}
