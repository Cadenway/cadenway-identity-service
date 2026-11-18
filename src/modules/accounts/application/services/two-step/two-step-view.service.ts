import type { TwoStepVerification } from '../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import { TWO_STEP_LIMITS } from '../../../domain/policies/two-step/two-step-limits.policy.js';
import type { SecurityKeyRecord } from '../../models/two-step/security-key-record.model.js';
import type { TwoStepSummary } from '../../models/two-step/two-step-summary.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { TwoStepRequirements } from '../../ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { TwoStepVerificationView } from '../../projections/two-step/two-step-verification-view.projection.js';

/**
 * Function toTwoStepVerificationView
 *
 * @description
 * The card "Vérification en deux étapes" of an account (`TwoStepVerification` of the contract):
 * the app ("Configurée le 3 mars 2026 · méthode principale"), the keys, the oldest first, the
 * backup codes left ("7 codes inutilisés sur 10") and the organizations whose policy requires it
 * ("Exigée par Atelier Nord pour les propriétaires et administrateurs."). Never a secret.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {TwoStepRequirements} requirements - The policies of the organizations of the account.
 * @param {string} userId - The account.
 * @returns {Promise<TwoStepVerificationView>} The card.
 */
export async function toTwoStepVerificationView(
  store: AccountsStore,
  requirements: TwoStepRequirements,
  userId: string,
): Promise<TwoStepVerificationView> {
  const verification: TwoStepVerification | null = await store.twoStep.find(userId);
  const requiredBy: TwoStepVerificationView['requiredBy'] = await requirements.of(userId);
  if (verification === null) {
    return { configuredAt: null, securityKeys: [], backupCodes: null, requiredBy };
  }
  const keys: SecurityKeyRecord[] = await store.securityKeys.listOfUser(userId);
  return {
    configuredAt: verification.snapshot.authenticatorConfiguredAt,
    securityKeys: keys.map((key: SecurityKeyRecord) => ({
      id: key.id,
      name: key.name,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    })),
    backupCodes: {
      remaining: await store.backupCodes.countUnused(userId),
      total: TWO_STEP_LIMITS.backupCodeCount,
      generatedAt: verification.snapshot.backupCodesGeneratedAt,
    },
    requiredBy,
  };
}

/**
 * Function summarizeTwoStepChange
 *
 * @description
 * What `user.two-step-verification-changed.v1` says after a change, read in its transaction once
 * the change is written: whether two-step verification is on, the configured methods
 * (`authenticator-app`, then `security-key` with a key) and the backup codes left.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {string} userId - The account.
 * @param {TwoStepSummary['change']} change - The change.
 * @param {TwoStepSummary['securityKey']} securityKey - The key added or removed, `null` otherwise.
 * @returns {Promise<TwoStepSummary>} The summary of the event.
 */
export async function summarizeTwoStepChange(
  store: AccountsStore,
  userId: string,
  change: TwoStepSummary['change'],
  securityKey: TwoStepSummary['securityKey'],
): Promise<TwoStepSummary> {
  if ((await store.twoStep.find(userId)) === null) {
    return { change, enabled: false, methods: [], backupCodesRemaining: 0, securityKey };
  }
  const keys: SecurityKeyRecord[] = await store.securityKeys.listOfUser(userId);
  return {
    change,
    enabled: true,
    methods: ['authenticator-app', ...(keys.length > 0 ? ['security-key'] : [])],
    backupCodesRemaining: await store.backupCodes.countUnused(userId),
    securityKey,
  };
}
