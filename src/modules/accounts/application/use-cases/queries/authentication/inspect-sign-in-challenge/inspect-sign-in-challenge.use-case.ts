import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { SignInChallenge } from '../../../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';
import type { TwoStepVerification } from '../../../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { ChallengeTokens } from '../../../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { SignInChallengeView } from '../../../../projections/two-step/sign-in-challenge-view.projection.js';
import { toSignInChallengeView } from '../../../../services/two-step/sign-in-challenge-view.service.js';
import type { InspectSignInChallengeInput } from './inspect-sign-in-challenge.input.js';

/**
 * Class InspectSignInChallenge
 *
 * @description
 * Reads a usable two-step challenge as the `202` of the sign-in gave it (`POST
 * /internal/v1/auth/sign-in/challenge/inspection`), without answering it or counting an attempt;
 * the token of the answer is the one of the request. A challenge that expired, was answered or
 * replaced, an unknown one and a malformed token answer `auth.challenge-expired`.
 */
export class InspectSignInChallenge {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The read-only transaction of the reading.
   *
   * @type {AccountsUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: AccountsUnitOfWork;

  /**
   * Property challengeTokens
   *
   * @description
   * Hashes the token of the challenge.
   *
   * @type {ChallengeTokens}
   * @readonly
   */
  private readonly challengeTokens: ChallengeTokens;

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
   * Takes its ports, bound by the composition of the module.
   *
   * @param {AccountsUnitOfWork} unitOfWork - The read-only transaction of the reading.
   * @param {ChallengeTokens} challengeTokens - Hashes the token of the challenge.
   * @param {Clock} clock - The time of the reading.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    challengeTokens: ChallengeTokens,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.challengeTokens = challengeTokens;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads the challenge.
   *
   * @param {InspectSignInChallengeInput} input - The token of the challenge.
   * @returns {Promise<SignInChallengeView>} The challenge.
   * @throws {AccountRefusal} `auth.challenge-expired`.
   */
  public async execute(input: InspectSignInChallengeInput): Promise<SignInChallengeView> {
    const tokenHash: string | null = this.challengeTokens.hashOf(input.token);
    if (tokenHash === null) {
      throw new AccountRefusal({ reason: 'challenge-expired' });
    }
    const now: Date = this.clock.now();
    return this.unitOfWork.run(
      async (store: AccountsStore): Promise<SignInChallengeView> => {
        const challenge: SignInChallenge | null = await store.challenges.findByTokenHash(
          tokenHash,
          false,
        );
        const user: User | null =
          challenge === null ? null : await store.users.findById(challenge.userId);
        const verification: TwoStepVerification | null =
          user === null ? null : await store.twoStep.find(user.id);
        if (challenge?.isUsableAt(now) !== true || user === null || verification === null) {
          throw new AccountRefusal({ reason: 'challenge-expired' });
        }
        return toSignInChallengeView(
          store,
          user,
          verification,
          input.token,
          challenge.expiresAt,
          now,
        );
      },
      { readOnly: true },
    );
  }
  // #endregion
}
