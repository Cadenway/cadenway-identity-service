import type { SessionsStore } from '../../../../models/session/sessions-store.model.js';
import type { Clock } from '../../../../ports/outbound/time/session/clock.port.js';
import type { SessionsUnitOfWork } from '../../../../ports/outbound/transactions/session/sessions-unit-of-work.port.js';
import type { RecordTwoStepVerificationInput } from './record-two-step-verification.input.js';

/**
 * Class RecordTwoStepVerification
 *
 * @description
 * Records whether an account has two-step verification (`two_step_enrollments`), the fact every
 * rule of this module that depends on it reads: the recent authentication, the withheld
 * organization of both introspections, the choice of an organization and the policy change (P2c-2).
 * The accounts module calls it in the transaction that turns two-step verification on or off; it
 * joins that system transaction, so the fact and the factors commit together. Calling it twice has
 * the effect of once.
 */
export class RecordTwoStepVerification {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The system transaction, joined to the one of the caller.
   *
   * @type {SessionsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: SessionsUnitOfWork;

  /**
   * Property clock
   *
   * @description
   * The time it turned on.
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
   * Takes its ports, bound by the composition of the module.
   *
   * @param {SessionsUnitOfWork} unitOfWork - The system transaction, joined to the one of the caller.
   * @param {Clock} clock - The time it turned on.
   * @constructor
   */
  public constructor(unitOfWork: SessionsUnitOfWork, clock: Clock) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Enrolls or unenrolls the account.
   *
   * @param {RecordTwoStepVerificationInput} input - The account and its state.
   * @returns {Promise<void>} Resolves once written.
   */
  public async execute(input: RecordTwoStepVerificationInput): Promise<void> {
    const now: Date = this.clock.now();
    await this.unitOfWork.run(async (store: SessionsStore): Promise<void> => {
      if (input.enabled) {
        await store.enrollments.enroll(input.userId, now);
      } else {
        await store.enrollments.unenroll(input.userId);
      }
    });
  }
  // #endregion
}
