import { FederatedSignInRefusedError } from '../../../../../domain/errors/federated-sign-in/federated-sign-in-refused.error.js';
import type { FederatedFinishAuthority } from '../../../../../domain/value-objects/federated-sign-in/federated-finish-authority.value-object.js';
import type { Clock } from '../../../../ports/outbound/clock/accounts/clock.port.js';
import type { DeviceReader } from '../../../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../../../ports/outbound/identity/sessions/session-opener.port.js';
import type { FederatedMembershipAuthority } from '../../../../ports/outbound/identity/memberships/federated-membership-authority.port.js';
import type { TrustedDevices } from '../../../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { SocialFlowCredentials } from '../../../../ports/outbound/security/federation/social-flow-credentials.port.js';
import type { ChallengeTokens } from '../../../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { FederatedFinishUnitOfWork } from '../../../../ports/outbound/transactions/federation/federated-finish-unit-of-work.port.js';
import type { SignInOutcome } from '../../../../projections/authentication/sign-in-outcome.projection.js';
import { completeFirstFactor } from '../../../../services/two-step/first-factor.service.js';
import type { FinishFederatedSignInInput } from './finish-federated-sign-in.input.js';
import { FederatedFinishRefusal } from '../../../../models/authentication/federated-finish-refusal.model.js';

/** Consumes a federated receipt and opens a session or challenge atomically. */
export class FinishFederatedSignIn {
  // #region Constructor
  /** Binds the transaction, receipt digester and existing sign-in services. */
  public constructor(
    private readonly work: FederatedFinishUnitOfWork,
    private readonly credentials: Pick<SocialFlowCredentials, 'digest'>,
    private readonly clock: Clock,
    private readonly sessions: SessionOpener,
    private readonly devices: DeviceReader,
    private readonly trustedDevices: TrustedDevices,
    private readonly challengeTokens: ChallengeTokens,
    private readonly membershipAuthority: FederatedMembershipAuthority | null,
  ) {}
  // #endregion

  // #region Methods
  /** Commits a policy refusal after consuming the receipt; unexpected failures roll it back. */
  public async execute(input: FinishFederatedSignInInput): Promise<SignInOutcome> {
    const receiptHash = this.credentials.digest(input.receipt);
    const selected = await this.work.run((store) => store.findByReceiptHash(receiptHash));
    if (selected === null) throw new FederatedFinishRefusal();
    const selectedState = selected.flow.snapshot;
    if (selectedState.phase.kind !== 'complete') throw new FederatedFinishRefusal();
    const selectedUserId = selectedState.phase.continuation.userId;
    let samlMembership = null;
    if (selectedState.connection.provider === 'saml') {
      if (this.membershipAuthority === null) {
        throw new Error('Organization membership authority is required for SAML sign-in.');
      }
      samlMembership = await this.membershipAuthority.find(
        selectedState.connection.organizationId,
        selectedUserId,
      );
      if (
        samlMembership === null ||
        samlMembership.memberId !== selectedState.phase.continuation.memberId
      ) {
        throw new FederatedFinishRefusal();
      }
    }
    const result = await this.work.run(async (store): Promise<SignInOutcome | null> => {
      const record = await store.findByReceiptHash(receiptHash);
      if (record === null) return null;
      const { phase, connection } = record.flow.snapshot;
      if (phase.kind !== 'complete' || phase.continuation.redeemedAtMs !== null) return null;
      const { identity, userId } = phase.continuation;
      if (
        userId !== selectedUserId ||
        record.flow.snapshot.id !== selectedState.id ||
        (connection.provider === 'saml' &&
          samlMembership?.organizationId !== connection.organizationId)
      ) {
        return null;
      }
      const user = await store.users.lock(userId);
      const link = await store.findLink(identity);
      const maySignIn = user !== null && (await store.isAllowed(userId, connection));
      const activeMembership =
        connection.provider === 'saml' &&
        samlMembership !== null &&
        (await store.activeMembershipId(userId, connection.organizationId)) ===
          samlMembership.memberId
          ? { userId, organizationId: connection.organizationId, memberId: samlMembership.memberId }
          : null;
      const verification = user === null ? null : await store.twoStep.find(userId);
      const trusted =
        verification !== null &&
        input.trustedDeviceToken !== undefined &&
        (await this.trustedDevices.isTrusted(userId, input.trustedDeviceToken));
      const authority: FederatedFinishAuthority = {
        account: user === null ? null : { id: user.id, enabled: user.isVerified },
        link,
        activeMembership,
        maySignIn,
        twoStep:
          verification === null
            ? 'not-required'
            : trusted
              ? 'trusted-device'
              : 'challenge-required',
      };
      let redemption;
      try {
        redemption = record.flow.redeem(receiptHash, authority, this.clock.now());
      } catch (error) {
        if (error instanceof FederatedSignInRefusedError) return null;
        throw error;
      }
      if (!(await store.save(redemption.flow, record.version))) {
        throw new Error('The locked federated flow changed during receipt redemption.');
      }
      if (redemption.decision.kind === 'refused' || user === null) return null;
      return completeFirstFactor(
        store,
        {
          sessions: this.sessions,
          devices: this.devices,
          trustedDevices: this.trustedDevices,
          challengeTokens: this.challengeTokens,
        },
        user,
        {
          persistent: redemption.decision.persistent,
          client: input.client,
          trustedDeviceToken: input.trustedDeviceToken,
          authentication: null,
          federatedBinding: {
            linkId: redemption.decision.audit.linkId,
            connection,
            ...(samlMembership === null ? {} : { memberId: samlMembership.memberId }),
          },
          samlMembership,
        },
        this.clock.now(),
      );
    });
    if (result === null) throw new FederatedFinishRefusal();
    return result;
  }
  // #endregion
}
