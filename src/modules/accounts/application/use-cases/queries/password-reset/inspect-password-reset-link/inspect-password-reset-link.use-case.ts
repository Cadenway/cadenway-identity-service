import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { PasswordResetLink } from '../../../../../domain/aggregates/password-reset/password-reset-link.aggregate.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { AccountSessions } from '../../../../ports/outbound/identity/sessions/account-sessions.port.js';
import type { ResetLinkSecrets } from '../../../../ports/outbound/security/password-reset/reset-link-secrets.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { InspectPasswordResetLinkInput } from './inspect-password-reset-link.input.js';
import type { InspectPasswordResetLinkOutput } from './inspect-password-reset-link.output.js';

/**
 * Class InspectPasswordResetLink
 *
 * @description
 * Tells the reset screen ("Choisir un nouveau mot de passe") which account a link is for, when it
 * expires and how many open sessions the account has, without using the link
 * (`POST /internal/v1/auth/password-reset/inspection`). A link that expired, was used, was replaced
 * or is unknown, and a malformed token, answer `auth.reset-link-expired` ("Ce lien a expiré").
 */
export class InspectPasswordResetLink {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the reading.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property secrets
   *
   * @description
   * Hashes the token.
   *
   * @type {ResetLinkSecrets}
   * @readonly
   */
  private readonly secrets: ResetLinkSecrets;

  /**
   * Property sessions
   *
   * @description
   * Counts the open sessions of the account.
   *
   * @type {AccountSessions}
   * @readonly
   */
  private readonly sessions: AccountSessions;

  /**
   * Property clock
   *
   * @description
   * The time of the reading.
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
   * Takes the ports of the reading.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The transaction.
   * @param {ResetLinkSecrets} secrets - Hashes the token.
   * @param {AccountSessions} sessions - Counts the open sessions.
   * @param {Clock} clock - The time of the reading.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    secrets: ResetLinkSecrets,
    sessions: AccountSessions,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.sessions = sessions;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads the account of a link.
   *
   * @param {InspectPasswordResetLinkInput} input - The token.
   * @returns {Promise<InspectPasswordResetLinkOutput>} The account, the expiry and the sessions.
   * @throws {AccountRefusal} `auth.reset-link-expired`.
   */
  public async execute(
    input: InspectPasswordResetLinkInput,
  ): Promise<InspectPasswordResetLinkOutput> {
    const tokenHash: string | null = this.secrets.hashOf(input.token);
    if (tokenHash === null) {
      throw new AccountRefusal({ reason: 'reset-link-expired' });
    }
    const now: Date = this.clock.now();
    const outcome: InspectPasswordResetLinkOutput | Refusal = await this.unitOfWork.run(
      async (store: AccountsStore): Promise<InspectPasswordResetLinkOutput | Refusal> => {
        const link: PasswordResetLink | null = await store.resetLinks.findByTokenHash(
          tokenHash,
          false,
        );
        if (link?.worksAt(now) !== true) {
          return { reason: 'reset-link-expired' };
        }
        const user: User | null = await store.users.findById(link.snapshot.userId);
        if (user?.isVerified !== true) {
          return { reason: 'reset-link-expired' };
        }
        return {
          email: user.email.value,
          expiresAt: link.snapshot.expiresAt,
          sessionCount: await this.sessions.countOpen(user.id),
        };
      },
    );
    if ('reason' in outcome) {
      throw new AccountRefusal(outcome);
    }
    return outcome;
  }
  // #endregion
}
