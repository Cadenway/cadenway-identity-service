import { Session } from '../../../../domain/aggregates/session/session.aggregate.js';
import type { SessionStart } from '../../../../domain/value-objects/session/session-start.value-object.js';
import type { SessionState } from '../../../../domain/value-objects/session/session-state.value-object.js';
import type { ActiveMembership } from '../../../models/session/active-membership.model.js';
import type { DeviceDescription } from '../../../models/session/device-description.model.js';
import type { IssuedToken } from '../../../models/session/issued-token.model.js';
import type { SessionOrigin } from '../../../models/session/session-origin.model.js';
import type { SessionsStore } from '../../../models/session/sessions-store.model.js';
import type { DeviceReader } from '../../../ports/outbound/device/session/device-reader.port.js';
import type { ActiveMemberships } from '../../../ports/outbound/memberships/session/active-memberships.port.js';
import type { SessionEvents } from '../../../ports/outbound/messaging/session/session-events.port.js';
import type { OrganizationChoiceRepository } from '../../../ports/outbound/persistence/session/organization-choice-repository.port.js';
import type { SessionRepository } from '../../../ports/outbound/persistence/session/session-repository.port.js';
import type { SessionTokens } from '../../../ports/outbound/security/session/session-tokens.port.js';
import type { Clock } from '../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';

/**
 * Interface StoredSession
 *
 * @description
 * A session row of the fake database.
 */
export interface StoredSession {
  // #region Properties
  /**
   * Property state
   *
   * @description
   * The state of the session.
   *
   * @type {SessionState}
   * @readonly
   */
  readonly state: SessionState;

  /**
   * Property origin
   *
   * @description
   * Its token hash and its browser.
   *
   * @type {SessionOrigin}
   * @readonly
   */
  readonly origin: SessionOrigin;
  // #endregion
}

/**
 * Class InMemorySessions
 *
 * @description
 * A fake `SessionsUnitOfWork` holding its data in memory, committed only when the work resolves.
 */
export class InMemorySessions implements SessionsUnitOfWork {
  // #region Properties
  /**
   * Property sessions
   *
   * @description
   * Committed sessions by id.
   *
   * @type {Map<string, StoredSession>}
   */
  public sessions: Map<string, StoredSession> = new Map<string, StoredSession>();

  /**
   * Property revoked
   *
   * @description
   * Committed `session.revoked.v1` events.
   *
   * @type {{ readonly session: Session; readonly actorUserId: string }[]}
   */
  public revoked: { readonly session: Session; readonly actorUserId: string }[] = [];

  /**
   * Property activityWrites
   *
   * @description
   * Activity writes committed.
   *
   * @type {number}
   */
  public activityWrites: number = 0;

  /**
   * Property choices
   *
   * @description
   * Committed last organization chosen, by account.
   *
   * @type {Map<string, string>}
   */
  public choices: Map<string, string> = new Map<string, string>();

  /**
   * Property ids
   *
   * @description
   * Ids assigned so far.
   *
   * @type {number}
   */
  private ids: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method run
   *
   * @description
   * Runs the work on a copy of the data, committed when it resolves.
   *
   * @param {(store: SessionsStore) => Promise<TResult>} work - The unit of work.
   * @returns {Promise<TResult>} What the work resolved with.
   */
  public async run<TResult>(work: (store: SessionsStore) => Promise<TResult>): Promise<TResult> {
    const sessions: Map<string, StoredSession> = new Map<string, StoredSession>(this.sessions);
    const revoked: { readonly session: Session; readonly actorUserId: string }[] = [
      ...this.revoked,
    ];
    const writes: { count: number } = { count: this.activityWrites };
    const choices: Map<string, string> = new Map<string, string>(this.choices);
    const repository: SessionRepository = {
      insert: (start: SessionStart, origin: SessionOrigin): Promise<Session> => {
        this.ids += 1;
        const state: SessionState = {
          ...start,
          id: `019a6a2e-4b1c-7d3e-8f5a-${String(this.ids).padStart(12, '0')}`,
          revokedAt: null,
        };
        sessions.set(state.id, { state, origin });
        return Promise.resolve(Session.restore(state));
      },
      findByTokenHash: (tokenHash: string): Promise<Session | null> => {
        const stored: StoredSession | undefined = [...sessions.values()].find(
          (session: StoredSession) => session.origin.tokenHash === tokenHash,
        );
        return Promise.resolve(stored === undefined ? null : Session.restore(stored.state));
      },
      findForUpdate: (id: string): Promise<Session | null> => {
        const stored: StoredSession | undefined = sessions.get(id);
        return Promise.resolve(stored === undefined ? null : Session.restore(stored.state));
      },
      recordActivity: (session: Session): Promise<void> => {
        const stored: StoredSession | undefined = sessions.get(session.id);
        if (stored !== undefined) {
          sessions.set(session.id, { ...stored, state: session.snapshot });
          writes.count += 1;
        }
        return Promise.resolve();
      },
      chooseOrganization: (session: Session): Promise<void> => {
        const stored: StoredSession | undefined = sessions.get(session.id);
        if (stored?.state.version !== session.snapshot.version - 1) {
          return Promise.reject(new Error('The session changed since it was loaded.'));
        }
        sessions.set(session.id, { ...stored, state: session.snapshot });
        return Promise.resolve();
      },
      revoke: (session: Session): Promise<void> => {
        const stored: StoredSession | undefined = sessions.get(session.id);
        if (stored !== undefined) {
          sessions.set(session.id, { ...stored, state: session.snapshot });
        }
        return Promise.resolve();
      },
    };
    const events: SessionEvents = {
      sessionRevoked: (session: Session, actorUserId: string): Promise<void> => {
        revoked.push({ session, actorUserId });
        return Promise.resolve();
      },
    };
    const organizationChoices: OrganizationChoiceRepository = {
      find: (userId: string): Promise<string | null> =>
        Promise.resolve(choices.get(userId) ?? null),
      remember: (userId: string, organizationId: string): Promise<void> => {
        choices.set(userId, organizationId);
        return Promise.resolve();
      },
    };
    const result: TResult = await work({ sessions: repository, organizationChoices, events });
    this.sessions = sessions;
    this.choices = choices;
    this.revoked = revoked;
    this.activityWrites = writes.count;
    return result;
  }
  // #endregion
}

/**
 * Class FakeActiveMemberships
 *
 * @description
 * A fake copy of the memberships: the active membership of each account in each organization.
 */
export class FakeActiveMemberships implements ActiveMemberships {
  // #region Properties
  /**
   * Property active
   *
   * @description
   * Active memberships by `<organizationId>/<userId>`.
   *
   * @type {Map<string, ActiveMembership>}
   */
  public active: Map<string, ActiveMembership> = new Map<string, ActiveMembership>();
  // #endregion

  // #region Methods
  /**
   * Method join
   *
   * @description
   * Makes an account a member of an organization, replacing a previous membership there.
   *
   * @param {string} userId - The account.
   * @param {ActiveMembership} membership - The membership.
   */
  public join(userId: string, membership: ActiveMembership): void {
    this.active.set(`${membership.organizationId}/${userId}`, membership);
  }

  /**
   * Method remove
   *
   * @description
   * Ends the membership of an account in an organization.
   *
   * @param {string} userId - The account.
   * @param {string} organizationId - The organization.
   */
  public remove(userId: string, organizationId: string): void {
    this.active.delete(`${organizationId}/${userId}`);
  }

  /**
   * Method find
   *
   * @description
   * The active membership of an account in an organization.
   *
   * @param {string} organizationId - The organization.
   * @param {string} userId - The account.
   * @returns {Promise<ActiveMembership | null>} The membership, or `null`.
   */
  public find(organizationId: string, userId: string): Promise<ActiveMembership | null> {
    return Promise.resolve(this.active.get(`${organizationId}/${userId}`) ?? null);
  }
  // #endregion
}

/**
 * Class FakeSessionTokens
 *
 * @description
 * Numbered tokens of the right format, hashed as `hash:<token>`.
 */
export class FakeSessionTokens implements SessionTokens {
  // #region Properties
  /**
   * Property issued
   *
   * @description
   * Tokens drawn so far.
   *
   * @type {number}
   */
  private issued: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method issue
   *
   * @description
   * Draws the next token.
   *
   * @returns {IssuedToken} The token and its fake hash.
   */
  public issue(): IssuedToken {
    this.issued += 1;
    const token: string = String(this.issued).padStart(43, 'T');
    return { token, tokenHash: `hash:${token}` };
  }

  /**
   * Method hashOf
   *
   * @description
   * The fake hash of a token of 43 characters.
   *
   * @param {string} token - The token.
   * @returns {string | null} Its fake hash, or `null`.
   */
  public hashOf(token: string): string | null {
    return token.length === 43 ? `hash:${token}` : null;
  }
  // #endregion
}

/**
 * Class FakeDeviceReader
 *
 * @description
 * Describes every `User-Agent` as Firefox 145 on Windows 10.
 */
export class FakeDeviceReader implements DeviceReader {
  // #region Methods
  /**
   * Method read
   *
   * @description
   * The fixed description, or unknown without a header.
   *
   * @param {string | null} userAgent - The header.
   * @returns {DeviceDescription} The description.
   */
  public read(userAgent: string | null): DeviceDescription {
    return userAgent === null
      ? { browser: null, operatingSystem: null, deviceType: null }
      : { browser: 'Firefox 145', operatingSystem: 'Windows 10', deviceType: 'desktop' };
  }
  // #endregion
}

/**
 * Class FixedClock
 *
 * @description
 * A clock that stays on an instant until a spec moves it.
 */
export class FixedClock implements Clock {
  // #region Properties
  /**
   * Property instant
   *
   * @description
   * The current instant, in milliseconds.
   *
   * @type {number}
   */
  private instant: number;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Starts the clock.
   *
   * @param {string} iso - The first instant, ISO 8601.
   * @constructor
   */
  public constructor(iso: string) {
    this.instant = Date.parse(iso);
  }
  // #endregion

  // #region Methods
  /**
   * Method now
   *
   * @description
   * Returns the current instant.
   *
   * @returns {Date} A new date for it.
   */
  public now(): Date {
    return new Date(this.instant);
  }

  /**
   * Method advance
   *
   * @description
   * Moves the clock forward.
   *
   * @param {number} milliseconds - How far.
   */
  public advance(milliseconds: number): void {
    this.instant += milliseconds;
  }
  // #endregion
}
