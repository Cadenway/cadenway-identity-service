import type {
  AuthenticatorAppConfigured,
  AuthenticatorAppSetup,
  BackupCodes,
  SecurityKey,
  SecurityKeyRegistration,
  TwoStepVerification,
  WebAuthnCreationOptions,
} from '@cadenway/contracts/types/internal/identity-service';

import type { TwoStepRequirement } from '../../../../application/models/two-step/two-step-requirement.model.js';
import type { AuthenticatorAppConfiguredView } from '../../../../application/projections/two-step/authenticator-app-configured-view.projection.js';
import type { AuthenticatorAppSetupView } from '../../../../application/projections/two-step/authenticator-app-setup-view.projection.js';
import type { BackupCodesView } from '../../../../application/projections/two-step/backup-codes-view.projection.js';
import type { SecurityKeyView } from '../../../../application/projections/two-step/security-key-view.projection.js';
import type { TwoStepVerificationView } from '../../../../application/projections/two-step/two-step-verification-view.projection.js';
import type { WebAuthnOptionsView } from '../../../../application/projections/two-step/web-authn-options-view.projection.js';

/**
 * Function toSecurityKey
 *
 * @description
 * Maps a security key to `SecurityKey` of the contract, without its credential.
 *
 * @param {SecurityKeyView} view - The key.
 * @returns {SecurityKey} The body.
 */
export function toSecurityKey(view: SecurityKeyView): SecurityKey {
  return {
    id: view.id,
    name: view.name,
    createdAt: view.createdAt.toISOString(),
    lastUsedAt: view.lastUsedAt?.toISOString() ?? null,
  };
}

/**
 * Function toTwoStepVerification
 *
 * @description
 * Maps the card of an account to `TwoStepVerification` of the contract: on while it has an
 * authenticator app, the primary method; the configured methods, never `backup-code`.
 *
 * @param {TwoStepVerificationView} view - The card.
 * @returns {TwoStepVerification} The body.
 */
export function toTwoStepVerification(view: TwoStepVerificationView): TwoStepVerification {
  const requiredBy: TwoStepVerification['requiredBy'] = view.requiredBy.map(
    (requirement: TwoStepRequirement) => ({
      organizationId: requirement.organizationId,
      requiredFor: requirement.requiredFor,
    }),
  );
  if (view.configuredAt === null) {
    return {
      enabled: false,
      primaryMethod: null,
      methods: [],
      authenticatorApp: null,
      securityKeys: [],
      backupCodes: null,
      requiredBy,
    };
  }
  return {
    enabled: true,
    primaryMethod: 'authenticator-app',
    methods: ['authenticator-app', ...(view.securityKeys.length > 0 ? ['security-key'] : [])],
    authenticatorApp: { configuredAt: view.configuredAt.toISOString() },
    securityKeys: view.securityKeys.map(toSecurityKey),
    backupCodes:
      view.backupCodes === null
        ? null
        : {
            remaining: view.backupCodes.remaining,
            total: view.backupCodes.total,
            generatedAt: view.backupCodes.generatedAt.toISOString(),
          },
    requiredBy,
  };
}

/**
 * Function toAuthenticatorAppSetup
 *
 * @description
 * Maps a started setup to `AuthenticatorAppSetup` of the contract. The secret and its URI are
 * returned once and never logged.
 *
 * @param {AuthenticatorAppSetupView} view - The setup.
 * @returns {AuthenticatorAppSetup} The body.
 */
export function toAuthenticatorAppSetup(view: AuthenticatorAppSetupView): AuthenticatorAppSetup {
  return {
    secret: view.secret,
    otpauthUri: view.otpauthUri,
    expiresAt: view.expiresAt.toISOString(),
  };
}

/**
 * Function toBackupCodes
 *
 * @description
 * Maps new backup codes to `BackupCodes` of the contract. They are returned once and never logged.
 *
 * @param {BackupCodesView} view - The codes.
 * @returns {BackupCodes} The body.
 */
export function toBackupCodes(view: BackupCodesView): BackupCodes {
  return { codes: [...view.codes], generatedAt: view.generatedAt.toISOString() };
}

/**
 * Function toAuthenticatorAppConfigured
 *
 * @description
 * Maps a confirmed app to `AuthenticatorAppConfigured` of the contract: the card, and the backup
 * codes when two-step verification turned on.
 *
 * @param {AuthenticatorAppConfiguredView} view - The confirmation.
 * @returns {AuthenticatorAppConfigured} The body.
 */
export function toAuthenticatorAppConfigured(
  view: AuthenticatorAppConfiguredView,
): AuthenticatorAppConfigured {
  return {
    twoStepVerification: toTwoStepVerification(view.twoStepVerification),
    backupCodes: view.backupCodes === null ? null : toBackupCodes(view.backupCodes),
  };
}

/**
 * Function toSecurityKeyRegistration
 *
 * @description
 * Maps the creation options of a pending registration to `SecurityKeyRegistration` of the
 * contract, as `@simplewebauthn/server` generated them.
 *
 * @param {WebAuthnOptionsView} view - The options and their expiry.
 * @returns {SecurityKeyRegistration} The body.
 */
export function toSecurityKeyRegistration(view: WebAuthnOptionsView): SecurityKeyRegistration {
  return {
    options: view.options as WebAuthnCreationOptions,
    expiresAt: view.expiresAt.toISOString(),
  };
}
