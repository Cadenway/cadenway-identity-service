import type { FactoryProvider } from '@nestjs/common';

import { OpenSession } from '../../../../../sessions/public/session/open-session.js';
import type { OpenedSession } from '../../../../application/models/sessions/opened-session.model.js';
import type { SessionRequest } from '../../../../application/models/sessions/session-request.model.js';
import type { SessionOpener } from '../../../../application/ports/outbound/identity/sessions/session-opener.port.js';
import { SESSION_OPENER } from '../../../tokens/accounts/session-opener.token.js';

/**
 * Constant sessionOpenerProvider
 *
 * @description
 * Binds the SessionOpener port to the Accounts adapter used at runtime.
 *
 * @type {FactoryProvider<SessionOpener>}
 */
export const sessionOpenerProvider: FactoryProvider<SessionOpener> = {
  provide: SESSION_OPENER,
  inject: [OpenSession],
  useFactory: (openSession: OpenSession): SessionOpener => ({
    open: (request: SessionRequest): Promise<OpenedSession> => openSession.execute(request),
  }),
};
