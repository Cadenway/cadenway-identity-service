import type { Session } from '../../../../../domain/aggregates/session/session.aggregate.js';
import { SessionNotFound } from '../../../../models/session/session-not-found.model.js';
import type { SessionRecord } from '../../../../models/session/session-record.model.js';
import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import { UserNotFound } from '../../../../models/session/user-not-found.model.js';
import type { DeviceReader } from '../../../../ports/outbound/device/session/device-reader.port.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { OpenSessionView } from '../../../../projections/session/open-session-view.projection.js';
import { findOpenSessionOf } from '../../../../services/session/open-sessions.service.js';
import type { ListUserSessionsInput } from './list-user-sessions.input.js';
import type { ListUserSessionsOutput } from './list-user-sessions.output.js';

/**
 * Class ListUserSessions
 *
 * @description
 * Lists the open sessions of the actor ("Sessions actives", `GET /internal/v1/users/{userId}/sessions`,
 * decision 6 of P2c): neither revoked, expired nor idle for 12 hours, the most recent sign-in first,
 * then by id, so a session keeps its place whatever its activity. Each carries the device read from
 * its stored `User-Agent`, the address of its sign-in, its last activity and whether it is the
 * session of the request. Another account answers `user.not-found`; a session of the request that
 * is not an open session of the actor, `session.not-found`. One read in a system transaction, by
 * account.
 */
export class ListUserSessions {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property devices
   *
   * @description
   * Reads the device of each session.
   *
   * @type {DeviceReader}
   * @readonly
   */
  private readonly devices: DeviceReader;

  /**
   * Property clock
   *
   * @description
   * The time of the list.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the list.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction.
   * @param {DeviceReader} devices - Reads the device of each session.
   * @param {Clock} clock - The time of the list.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, devices: DeviceReader, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.devices = devices;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads one page of the open sessions.
   *
   * @param {ListUserSessionsInput} input - The person, the session of the request and the page.
   * @returns {Promise<ListUserSessionsOutput>} The page and where the next one starts.
   * @throws {UserNotFound} When the account of the path is not the actor.
   * @throws {SessionNotFound} When the session of the request is not an open session of the actor.
   */
  public async execute(input: ListUserSessionsInput): Promise<ListUserSessionsOutput> {
    if (input.actorUserId !== input.userId) {
      throw new UserNotFound();
    }
    const now: Date = this.clock.now();
    const records: SessionRecord[] = await this.unitOfWork.run(
      async (store: SessionsStore): Promise<SessionRecord[]> => {
        const current: Session | null = await findOpenSessionOf(
          store,
          input.userId,
          input.currentSessionId,
          now,
          false,
        );
        if (current === null) {
          throw new SessionNotFound();
        }
        return store.sessions.listOpen(input.userId, now, input.after, input.limit + 1);
      },
    );
    const page: SessionRecord[] = records.slice(0, input.limit);
    const last: SessionRecord | undefined = page.at(-1);
    return {
      items: page.map((record: SessionRecord): OpenSessionView => ({
        id: record.session.id,
        current: record.session.id === input.currentSessionId,
        device: this.devices.read(record.userAgent),
        ipAddress: record.ipAddress,
        signedInAt: record.session.snapshot.signedInAt,
        lastActiveAt: record.session.snapshot.lastActiveAt,
        expiresAt: record.session.snapshot.expiresAt,
      })),
      next:
        records.length > input.limit && last !== undefined
          ? { signedInAt: last.session.snapshot.signedInAt, id: last.session.id }
          : null,
    };
  }
  // #endregion
}
