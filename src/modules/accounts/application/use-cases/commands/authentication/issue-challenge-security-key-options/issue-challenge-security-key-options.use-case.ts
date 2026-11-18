import { SignInChallenge } from '../../../../../domain/aggregates/two-step/sign-in-challenge.aggregate.js';
import { AccountRefusal } from '../../../../models/authentication/account-refusal.model.js';
import type { Refusal } from '../../../../models/authentication/refusal.model.js';
import type { SecurityKeyRecord } from '../../../../models/two-step/security-key-record.model.js';
import type { WebAuthnOptions } from '../../../../models/two-step/web-authn-options.model.js';
import type { AccountsStore } from '../../../../models/transactions/accounts-store.model.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { ChallengeTokens } from '../../../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { WebAuthn } from '../../../../ports/outbound/security/two-step/web-authn.port.js';
import type { AccountsUnitOfWork } from '../../../../ports/outbound/transactions/accounts/accounts-unit-of-work.port.js';
import type { WebAuthnOptionsView } from '../../../../projections/two-step/web-authn-options-view.projection.js';
import {
  lockChallenge,
  lockoutRefusal,
} from '../../../../services/two-step/challenge-answers.service.js';
import type { IssueChallengeSecurityKeyOptionsInput } from './issue-challenge-security-key-options.input.js';

/**
 * Class IssueChallengeSecurityKeyOptions
 *
 * @description
 * Issues the WebAuthn request options of a two-step challenge (`POST
 * /internal/v1/auth/sign-in/challenge/security-key/options`), valid 5 minutes, allowing the keys of
 * its account only, in place of its previous options. A challenge no longer usable answers
 * `auth.challenge-expired`, a lockout `auth.two-step-locked`, an account without a key
 * `auth.security-key-refused`; nothing is counted.
 */
export class IssueChallengeSecurityKeyOptions {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The transaction of the options.
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
   * Property webAuthn
   *
   * @description
   * Generates the options.
   *
   * @type {WebAuthn}
   * @readonly
   */
  private readonly webAuthn: WebAuthn;

  /**
   * Property clock
   *
   * @description
   * The time of the request.
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
   * @param {AccountsUnitOfWork} unitOfWork - The transaction of the options.
   * @param {ChallengeTokens} challengeTokens - Hashes the token of the challenge.
   * @param {WebAuthn} webAuthn - Generates the options.
   * @param {Clock} clock - The time of the request.
   * @constructor
   */
  public constructor(
    unitOfWork: AccountsUnitOfWork,
    challengeTokens: ChallengeTokens,
    webAuthn: WebAuthn,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.challengeTokens = challengeTokens;
    this.webAuthn = webAuthn;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Issues the options of the challenge.
   *
   * @param {IssueChallengeSecurityKeyOptionsInput} input - The token of the challenge.
   * @returns {Promise<WebAuthnOptionsView>} The options and their expiry.
   * @throws {AccountRefusal} `auth.challenge-expired`, `auth.two-step-locked` or `auth.security-key-refused`.
   */
  public async execute(input: IssueChallengeSecurityKeyOptionsInput): Promise<WebAuthnOptionsView> {
    const now: Date = this.clock.now();
    return this.unitOfWork.run(async (store: AccountsStore): Promise<WebAuthnOptionsView> => {
      const located = await lockChallenge(store, this.challengeTokens, input.token, now);
      if ('reason' in located) {
        throw new AccountRefusal(located);
      }
      const locked: Refusal | null = lockoutRefusal(located.verification, now);
      if (locked !== null) {
        throw new AccountRefusal(locked);
      }
      const keys: SecurityKeyRecord[] = await store.securityKeys.listOfUser(located.user.id);
      if (keys.length === 0) {
        throw new AccountRefusal({ reason: 'security-key-refused', remainingAttempts: null });
      }
      const options: WebAuthnOptions = await this.webAuthn.assertionOptions(
        keys.map((key: SecurityKeyRecord) => ({
          id: key.credentialId,
          transports: key.transports,
        })),
      );
      await store.challenges.saveAssertion(located.challenge.withAssertion(options.challenge, now));
      return {
        options: options.options,
        expiresAt: new Date(now.getTime() + SignInChallenge.ASSERTION_LIFETIME_MS),
      };
    });
  }
  // #endregion
}
