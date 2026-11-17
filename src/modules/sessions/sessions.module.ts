import { Module } from '@nestjs/common';

import { MembershipsModule } from '../memberships/memberships.module.js';
import { activeMembershipsProvider } from './composition/providers/adapters/session/active-memberships.provider.js';
import { sessionClockProvider } from './composition/providers/adapters/session/clock.provider.js';
import { deviceReaderProvider } from './composition/providers/adapters/session/device-reader.provider.js';
import { sessionTokensProvider } from './composition/providers/adapters/session/session-tokens.provider.js';
import { sessionsUnitOfWorkProvider } from './composition/providers/adapters/session/sessions-unit-of-work.provider.js';
import { tenantSessionsUnitOfWorkProvider } from './composition/providers/adapters/session/tenant-sessions-unit-of-work.provider.js';
import { authenticateSessionProvider } from './composition/providers/use-cases/session/authenticate-session.provider.js';
import { checkOrganizationSessionAuthenticationProvider } from './composition/providers/use-cases/session/check-organization-session-authentication.provider.js';
import { checkSessionAuthenticationProvider } from './composition/providers/use-cases/session/check-session-authentication.provider.js';
import { countOpenSessionsProvider } from './composition/providers/use-cases/session/count-open-sessions.provider.js';
import { endRecentAuthenticationProvider } from './composition/providers/use-cases/session/end-recent-authentication.provider.js';
import { eraseUserSessionsProvider } from './composition/providers/use-cases/session/erase-user-sessions.provider.js';
import { introspectTokenProvider } from './composition/providers/use-cases/session/introspect-token.provider.js';
import { listUserSessionsProvider } from './composition/providers/use-cases/session/list-user-sessions.provider.js';
import { openSessionProvider } from './composition/providers/use-cases/session/open-session.provider.js';
import { revokeOtherSessionsProvider } from './composition/providers/use-cases/session/revoke-other-sessions.provider.js';
import { revokeSessionProvider } from './composition/providers/use-cases/session/revoke-session.provider.js';
import { revokeUserSessionsProvider } from './composition/providers/use-cases/session/revoke-user-sessions.provider.js';
import { switchSessionOrganizationProvider } from './composition/providers/use-cases/session/switch-session-organization.provider.js';
import { SessionsController } from './presentation/http/controllers/session/sessions.controller.js';
import { UserSessionsController } from './presentation/http/controllers/session/user-sessions.controller.js';
import { TokensController } from './presentation/http/controllers/token/tokens.controller.js';
import { AuthenticateSession } from './public/session/authenticate-session.js';
import { CheckOrganizationSessionAuthentication } from './public/session/check-organization-session-authentication.js';
import { CheckSessionAuthentication } from './public/session/check-session-authentication.js';
import { CountOpenSessions } from './public/session/count-open-sessions.js';
import { EndRecentAuthentication } from './public/session/end-recent-authentication.js';
import { EraseUserSessions } from './public/session/erase-user-sessions.js';
import { OpenSession } from './public/session/open-session.js';
import { RevokeUserSessions } from './public/session/revoke-user-sessions.js';

/**
 * Class SessionsModule
 *
 * @description
 * Registers the sessions HTTP controllers and operation factories. Accounts receives the
 * same OpenSession provider that joins the system transaction of a verified sign-in, and the
 * operations the security of an account needs (the checks and the recording of a recent
 * authentication, its end, the revocation, the count and the erasure of the sessions of a person),
 * which join its system transaction too. The api-tokens module receives the check of a recent
 * authentication that joins its tenant transaction. The copy of the memberships comes from
 * `FindActiveMembership`, exported by `MembershipsModule`, behind the `ActiveMemberships` port of
 * this module.
 */
@Module({
  imports: [MembershipsModule],
  controllers: [TokensController, SessionsController, UserSessionsController],
  providers: [
    sessionsUnitOfWorkProvider,
    tenantSessionsUnitOfWorkProvider,
    sessionTokensProvider,
    deviceReaderProvider,
    activeMembershipsProvider,
    sessionClockProvider,
    openSessionProvider,
    introspectTokenProvider,
    revokeSessionProvider,
    switchSessionOrganizationProvider,
    revokeOtherSessionsProvider,
    listUserSessionsProvider,
    checkSessionAuthenticationProvider,
    checkOrganizationSessionAuthenticationProvider,
    authenticateSessionProvider,
    endRecentAuthenticationProvider,
    revokeUserSessionsProvider,
    countOpenSessionsProvider,
    eraseUserSessionsProvider,
  ],
  exports: [
    OpenSession,
    CheckSessionAuthentication,
    CheckOrganizationSessionAuthentication,
    AuthenticateSession,
    EndRecentAuthentication,
    RevokeUserSessions,
    CountOpenSessions,
    EraseUserSessions,
  ],
})
export class SessionsModule {}
