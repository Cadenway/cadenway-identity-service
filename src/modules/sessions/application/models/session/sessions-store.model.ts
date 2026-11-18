import type { AuthenticationPolicyRepository } from '../../ports/outbound/persistence/authentication-policy/authentication-policy-repository.port.js';
import type { TrustedDeviceRepository } from '../../ports/outbound/persistence/session/trusted-device-repository.port.js';
import type { TwoStepEnrollmentRepository } from '../../ports/outbound/persistence/session/two-step-enrollment-repository.port.js';
import type { SessionEvents } from '../../ports/outbound/messaging/session/session-events.port.js';
import type { OrganizationChoiceRepository } from '../../ports/outbound/persistence/session/organization-choice-repository.port.js';
import type { SessionRepository } from '../../ports/outbound/persistence/session/session-repository.port.js';

/**
 * Interface SessionsStore
 *
 * @description
 * The repositories and the outbox of one transaction.
 */
export interface SessionsStore {
  // #region Properties
  /**
   * Property sessions
   *
   * @description
   * The sessions.
   *
   * @type {SessionRepository}
   * @readonly
   */
  readonly sessions: SessionRepository;

  /**
   * Property organizationChoices
   *
   * @description
   * The last organization each account chose.
   *
   * @type {OrganizationChoiceRepository}
   * @readonly
   */
  readonly organizationChoices: OrganizationChoiceRepository;

  /**
   * Property events
   *
   * @description
   * The outbox of the transaction.
   *
   * @type {SessionEvents}
   * @readonly
   */
  readonly events: SessionEvents;

  /**
   * Property policies
   *
   * @description
   * The authentication policies of the organizations.
   *
   * @type {AuthenticationPolicyRepository}
   * @readonly
   */
  readonly policies: AuthenticationPolicyRepository;

  /**
   * Property trustedDevices
   *
   * @description
   * The trusted devices of the accounts.
   *
   * @type {TrustedDeviceRepository}
   * @readonly
   */
  readonly trustedDevices: TrustedDeviceRepository;

  /**
   * Property enrollments
   *
   * @description
   * The accounts with two-step verification.
   *
   * @type {TwoStepEnrollmentRepository}
   * @readonly
   */
  readonly enrollments: TwoStepEnrollmentRepository;
  // #endregion
}
