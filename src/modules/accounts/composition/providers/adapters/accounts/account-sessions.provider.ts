import type { FactoryProvider } from '@nestjs/common';

import { AuthenticateSession } from '../../../../../sessions/public/session/authenticate-session.js';
import type { AuthenticateSessionOutput } from '../../../../../sessions/public/session/authenticate-session.js';
import { CheckSessionAuthentication } from '../../../../../sessions/public/session/check-session-authentication.js';
import type { CheckSessionAuthenticationOutput } from '../../../../../sessions/public/session/check-session-authentication.js';
import { CountOpenSessions } from '../../../../../sessions/public/session/count-open-sessions.js';
import type { CountOpenSessionsOutput } from '../../../../../sessions/public/session/count-open-sessions.js';
import { EndRecentAuthentication } from '../../../../../sessions/public/session/end-recent-authentication.js';
import { EraseUserSessions } from '../../../../../sessions/public/session/erase-user-sessions.js';
import { RevokeUserSessions } from '../../../../../sessions/public/session/revoke-user-sessions.js';
import type { RevokeUserSessionsOutput } from '../../../../../sessions/public/session/revoke-user-sessions.js';
import type { RecentAuthentication } from '../../../../application/models/sessions/recent-authentication.model.js';
import type { SessionAuthentication } from '../../../../application/models/sessions/session-authentication.model.js';
import type { AccountSessions } from '../../../../application/ports/outbound/identity/sessions/account-sessions.port.js';
import { ACCOUNT_SESSIONS } from '../../../tokens/accounts/account-sessions.token.js';

/**
 * Constant accountSessionsProvider
 *
 * @description
 * Binds the `AccountSessions` port of the accounts module to the operations the sessions module
 * exports for it. Each of them runs in the system runner of the kit and joins the transaction of
 * the use case that calls it.
 *
 * @type {FactoryProvider<AccountSessions>}
 */
export const accountSessionsProvider: FactoryProvider<AccountSessions> = {
  provide: ACCOUNT_SESSIONS,
  inject: [
    CheckSessionAuthentication,
    AuthenticateSession,
    EndRecentAuthentication,
    RevokeUserSessions,
    CountOpenSessions,
    EraseUserSessions,
  ],
  useFactory: (
    checkSessionAuthentication: CheckSessionAuthentication,
    authenticateSession: AuthenticateSession,
    endRecentAuthentication: EndRecentAuthentication,
    revokeUserSessions: RevokeUserSessions,
    countOpenSessions: CountOpenSessions,
    eraseUserSessions: EraseUserSessions,
  ): AccountSessions => ({
    check: async (userId: string, sessionId: string): Promise<SessionAuthentication> => {
      const checked: CheckSessionAuthenticationOutput = await checkSessionAuthentication.execute({
        userId,
        sessionId,
      });
      return checked.status;
    },
    authenticate: async (
      userId: string,
      sessionId: string,
    ): Promise<RecentAuthentication | null> => {
      const recent: AuthenticateSessionOutput | null = await authenticateSession.execute({
        userId,
        sessionId,
      });
      return recent === null
        ? null
        : { authenticatedAt: recent.authenticatedAt, expiresAt: recent.expiresAt };
    },
    endRecentAuthentication: (userId: string, exceptSessionId: string | null): Promise<void> =>
      endRecentAuthentication.execute({ userId, exceptSessionId }),
    revokeAll: async (userId: string, exceptSessionId: string | null): Promise<number> => {
      const revoked: RevokeUserSessionsOutput = await revokeUserSessions.execute({
        userId,
        exceptSessionId,
      });
      return revoked.revokedCount;
    },
    countOpen: async (userId: string): Promise<number> => {
      const counted: CountOpenSessionsOutput = await countOpenSessions.execute({ userId });
      return counted.count;
    },
    erase: (userId: string): Promise<void> => eraseUserSessions.execute({ userId }),
  }),
};
