import { TwoStepVerification } from '../../../domain/aggregates/two-step/two-step-verification.aggregate.js';
import type { InMemoryAccounts } from '../accounts/accounts.fixture.js';
import type { SessionClient } from '../sessions/session-client.model.js';
import type { TrustedDeviceGrant } from '../sessions/trusted-device-grant.model.js';
import type { CredentialDescriptor } from './credential-descriptor.model.js';
import type { IssuedChallengeToken } from './issued-challenge-token.model.js';
import type { SecurityKeyRecord } from './security-key-record.model.js';
import type { TwoStepRequirement } from './two-step-requirement.model.js';
import type { VerifiedAssertion } from './verified-assertion.model.js';
import type { VerifiedRegistration } from './verified-registration.model.js';
import type { WebAuthnOptions } from './web-authn-options.model.js';
import type { SessionIssuedView } from '../../projections/authentication/session-issued-view.projection.js';
import type { SignInOutcome } from '../../projections/authentication/sign-in-outcome.projection.js';
import type { SignInChallengeView } from '../../projections/two-step/sign-in-challenge-view.projection.js';
import type { TrustedDevices } from '../../ports/outbound/identity/sessions/trusted-devices.port.js';
import type { TwoStepRequirements } from '../../ports/outbound/identity/sessions/two-step-requirements.port.js';
import type { AuthenticatorAppSecrets } from '../../ports/outbound/security/two-step/authenticator-app-secrets.port.js';
import type { BackupCodeSecrets } from '../../ports/outbound/security/two-step/backup-code-secrets.port.js';
import type { ChallengeTokens } from '../../ports/outbound/security/two-step/challenge-tokens.port.js';
import type { Totp } from '../../ports/outbound/security/two-step/totp.port.js';
import type { WebAuthn } from '../../ports/outbound/security/two-step/web-authn.port.js';

/**
 * Constant FIREFOX
 *
 * @description
 * The browser of Camille Martin, as the gateway forwards it.
 *
 * @type {SessionClient}
 */
export const FIREFOX: SessionClient = {
  ipAddress: '86.247.12.30',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

/**
 * Class FakeAuthenticatorAppSecrets
 *
 * @description
 * Draws numbered secrets and seals one as `sealed:<account>:<secret>`; opening it for another
 * account fails, as the authenticated encryption of the adapter does.
 */
export class FakeAuthenticatorAppSecrets implements AuthenticatorAppSecrets {
  // #region Properties
  /**
   * Property drawn
   *
   * @description
   * Secrets drawn so far.
   *
   * @type {number}
   */
  private drawn: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method generate
   *
   * @description
   * A new numbered secret.
   *
   * @returns {string} The secret.
   */
  public generate(): string {
    this.drawn += 1;
    return `JBSWY3DPEHPK3PX${String(this.drawn)}`;
  }

  /**
   * Method seal
   *
   * @description
   * Seals a secret for an account.
   *
   * @param {string} userId - The account.
   * @param {string} secret - The secret.
   * @returns {string} The sealed secret.
   */
  public seal(userId: string, secret: string): string {
    return `sealed:${userId}:${secret}`;
  }

  /**
   * Method open
   *
   * @description
   * Opens a secret sealed for the account.
   *
   * @param {string} userId - The account.
   * @param {string} sealed - The sealed secret.
   * @returns {string} The secret.
   * @throws {Error} When it was sealed for another account.
   */
  public open(userId: string, sealed: string): string {
    const prefix: string = `sealed:${userId}:`;
    if (!sealed.startsWith(prefix)) {
      throw new Error('The secret was sealed for another account.');
    }
    return sealed.slice(prefix.length);
  }
  // #endregion
}

/**
 * Class FakeTotp
 *
 * @description
 * A TOTP whose code of a time step is `FakeTotp.codeOf(secret, step)`, with 30-second steps, one
 * step of tolerance either way and the steps up to `afterTimeStep` refused, as the adapter does.
 */
export class FakeTotp implements Totp {
  // #region Methods
  /**
   * Method codeOf
   *
   * @description
   * The code of a secret at a time step.
   *
   * @param {string} secret - The secret.
   * @param {number} timeStep - The time step.
   * @returns {string} The 6 digits.
   */
  public static codeOf(secret: string, timeStep: number): string {
    return String((secret.length * 7919 + timeStep) % 1_000_000).padStart(6, '0');
  }

  /**
   * Method stepAt
   *
   * @description
   * The time step of an instant.
   *
   * @param {Date} at - The instant.
   * @returns {number} Its 30-second step.
   */
  public static stepAt(at: Date): number {
    return Math.floor(at.getTime() / 30_000);
  }

  /**
   * Method verify
   *
   * @description
   * The time step of the code, or `null` when it is wrong or already accepted.
   *
   * @param {string} secret - The secret.
   * @param {string} code - The code, as typed.
   * @param {Date} at - The instant of the check.
   * @param {number | null} afterTimeStep - The last step accepted.
   * @returns {Promise<number | null>} The step.
   */
  public verify(
    secret: string,
    code: string,
    at: Date,
    afterTimeStep: number | null,
  ): Promise<number | null> {
    const current: number = FakeTotp.stepAt(at);
    for (const step of [current - 1, current, current + 1]) {
      if (
        FakeTotp.codeOf(secret, step) === code &&
        (afterTimeStep === null || step > afterTimeStep)
      ) {
        return Promise.resolve(step);
      }
    }
    return Promise.resolve(null);
  }

  /**
   * Method uriOf
   *
   * @description
   * The `otpauth://` URI of a secret.
   *
   * @param {string} secret - The secret.
   * @param {string} accountName - The address of the account.
   * @returns {string} The URI.
   */
  public uriOf(secret: string, accountName: string): string {
    return `otpauth://totp/Cadenway:${accountName}?secret=${secret}&issuer=Cadenway`;
  }
  // #endregion
}

/**
 * Class FakeBackupCodeSecrets
 *
 * @description
 * Draws the 10 codes `ABCD-000n` and hashes one as `hash:<account>:<normalized>`, the dash and the
 * case ignored; a malformed answer has no hash.
 */
export class FakeBackupCodeSecrets implements BackupCodeSecrets {
  // #region Properties
  /**
   * Property batches
   *
   * @description
   * Batches drawn so far.
   *
   * @type {number}
   */
  private batches: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method generate
   *
   * @description
   * 10 new codes.
   *
   * @returns {string[]} The codes.
   */
  public generate(): string[] {
    this.batches += 1;
    return Array.from(
      { length: 10 },
      (_: unknown, index: number): string =>
        `ABC${String(this.batches)}-${String(index).padStart(4, '0')}`,
    );
  }

  /**
   * Method hashOf
   *
   * @description
   * The hash of an answer, or `null` when malformed.
   *
   * @param {string} userId - The account.
   * @param {string} code - The answer.
   * @returns {string | null} The hash.
   */
  public hashOf(userId: string, code: string): string | null {
    const normalized: string = code.replace('-', '').toUpperCase();
    return /^[A-Z0-9]{8}$/.test(normalized) ? `hash:${userId}:${normalized}` : null;
  }
  // #endregion
}

/**
 * Class FakeChallengeTokens
 *
 * @description
 * Issues the tokens `challenge-n`, hashed as `hash:challenge-n`; any other token has no hash.
 */
export class FakeChallengeTokens implements ChallengeTokens {
  // #region Properties
  /**
   * Property issued
   *
   * @description
   * Tokens issued so far.
   *
   * @type {number}
   */
  public issued: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method issue
   *
   * @description
   * A new token and its hash.
   *
   * @returns {IssuedChallengeToken} The token.
   */
  public issue(): IssuedChallengeToken {
    this.issued += 1;
    const token: string = `challenge-${String(this.issued)}`;
    return { token, tokenHash: `hash:${token}` };
  }

  /**
   * Method hashOf
   *
   * @description
   * The hash of a token, or `null` when malformed.
   *
   * @param {string} token - The token.
   * @returns {string | null} The hash.
   */
  public hashOf(token: string): string | null {
    return token.startsWith('challenge-') ? `hash:${token}` : null;
  }
  // #endregion
}

/**
 * Class FakeWebAuthn
 *
 * @description
 * A relying party whose options carry a numbered `challenge`; an answer verifies when it echoes
 * that challenge (`response.challenge`) and, for an assertion, names the key (`response.id`) and
 * the handle of the account (`response.userHandle`). The counter of a used key goes up by one.
 */
export class FakeWebAuthn implements WebAuthn {
  // #region Properties
  /**
   * Property drawn
   *
   * @description
   * Handles and challenges drawn so far.
   *
   * @type {number}
   */
  private drawn: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method newUserHandle
   *
   * @description
   * A new numbered handle.
   *
   * @returns {string} The handle.
   */
  public newUserHandle(): string {
    this.drawn += 1;
    return `handle-${String(this.drawn)}`;
  }

  /**
   * Method registrationOptions
   *
   * @description
   * Creation options with a new challenge and the excluded keys.
   *
   * @param {string} userHandle - The handle of the account.
   * @param {string} email - Its address.
   * @param {string} name - Its name.
   * @param {readonly CredentialDescriptor[]} exclude - Its keys.
   * @returns {Promise<WebAuthnOptions>} The options.
   */
  public registrationOptions(
    userHandle: string,
    email: string,
    name: string,
    exclude: readonly CredentialDescriptor[],
  ): Promise<WebAuthnOptions> {
    this.drawn += 1;
    const challenge: string = `registration-${String(this.drawn)}`;
    return Promise.resolve({
      options: {
        challenge,
        user: { id: userHandle, name: email, displayName: name },
        excludeCredentials: exclude.map((key: CredentialDescriptor) => key.id),
      },
      challenge,
    });
  }

  /**
   * Method verifyRegistration
   *
   * @description
   * The new key when the answer echoes the challenge.
   *
   * @param {Readonly<Record<string, unknown>>} response - The answer.
   * @param {string} expectedChallenge - The challenge.
   * @returns {Promise<VerifiedRegistration | null>} The key, or `null`.
   */
  public verifyRegistration(
    response: Readonly<Record<string, unknown>>,
    expectedChallenge: string,
  ): Promise<VerifiedRegistration | null> {
    if (response.challenge !== expectedChallenge || typeof response.id !== 'string') {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      credentialId: response.id,
      publicKey: `public-key-of-${response.id}`,
      counter: 0,
      transports: ['usb'],
      backupEligible: false,
      backedUp: false,
      userVerified: false,
    });
  }

  /**
   * Method assertionOptions
   *
   * @description
   * Request options with a new challenge and the allowed keys.
   *
   * @param {readonly CredentialDescriptor[]} allow - The keys of the account.
   * @returns {Promise<WebAuthnOptions>} The options.
   */
  public assertionOptions(allow: readonly CredentialDescriptor[]): Promise<WebAuthnOptions> {
    this.drawn += 1;
    const challenge: string = `assertion-${String(this.drawn)}`;
    return Promise.resolve({
      options: {
        challenge,
        allowCredentials: allow.map((key: CredentialDescriptor) => key.id),
      },
      challenge,
    });
  }

  /**
   * Method verifyAssertion
   *
   * @description
   * The new counter when the answer echoes the challenge, names the key and the handle.
   *
   * @param {Readonly<Record<string, unknown>>} response - The answer.
   * @param {string} expectedChallenge - The challenge.
   * @param {SecurityKeyRecord} key - The key the answer names.
   * @param {string} userHandle - The handle of the account.
   * @returns {Promise<VerifiedAssertion | null>} The counter, or `null`.
   */
  public verifyAssertion(
    response: Readonly<Record<string, unknown>>,
    expectedChallenge: string,
    key: SecurityKeyRecord,
    userHandle: string,
  ): Promise<VerifiedAssertion | null> {
    const verified: boolean =
      response.challenge === expectedChallenge &&
      response.id === key.credentialId &&
      response.userHandle === userHandle;
    return Promise.resolve(verified ? { newCounter: key.counter + 1 } : null);
  }
  // #endregion
}

/**
 * Class FakeTrustedDevices
 *
 * @description
 * Trusts browsers with the tokens `device-n` for 30 days after the fixture instant, and forgets
 * every one of an account at once.
 */
export class FakeTrustedDevices implements TrustedDevices {
  // #region Properties
  /**
   * Property devices
   *
   * @description
   * The trusted tokens by account.
   *
   * @type {Map<string, Set<string>>}
   * @readonly
   */
  public readonly devices = new Map<string, Set<string>>();

  /**
   * Property forgotten
   *
   * @description
   * The accounts whose devices were forgotten, in order.
   *
   * @type {string[]}
   * @readonly
   */
  public readonly forgotten: string[] = [];

  /**
   * Property issued
   *
   * @description
   * Tokens issued so far.
   *
   * @type {number}
   */
  private issued: number = 0;
  // #endregion

  // #region Methods
  /**
   * Method trust
   *
   * @description
   * Trusts the browser of a new sign-in.
   *
   * @param {string} userId - The account.
   * @returns {Promise<TrustedDeviceGrant>} The token and its expiry.
   */
  public trust(userId: string): Promise<TrustedDeviceGrant> {
    this.issued += 1;
    const token: string = `device-${String(this.issued)}`;
    const tokens: Set<string> = this.devices.get(userId) ?? new Set<string>();
    tokens.add(token);
    this.devices.set(userId, tokens);
    return Promise.resolve({ token, expiresAt: new Date('2026-12-09T13:12:00Z') });
  }

  /**
   * Method isTrusted
   *
   * @description
   * Whether the account trusts a token.
   *
   * @param {string} userId - The account.
   * @param {string} token - The token.
   * @returns {Promise<boolean>} Whether it does.
   */
  public isTrusted(userId: string, token: string): Promise<boolean> {
    return Promise.resolve(this.devices.get(userId)?.has(token) === true);
  }

  /**
   * Method forget
   *
   * @description
   * Forgets every trusted device of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves at once.
   */
  public forget(userId: string): Promise<void> {
    this.devices.delete(userId);
    this.forgotten.push(userId);
    return Promise.resolve();
  }
  // #endregion
}

/**
 * Class FakeTwoStepRequirements
 *
 * @description
 * The organizations whose policy requires two-step verification of each account, as a spec sets
 * them.
 */
export class FakeTwoStepRequirements implements TwoStepRequirements {
  // #region Properties
  /**
   * Property required
   *
   * @description
   * The requirements by account.
   *
   * @type {Map<string, readonly TwoStepRequirement[]>}
   * @readonly
   */
  public readonly required = new Map<string, readonly TwoStepRequirement[]>();
  // #endregion

  // #region Methods
  /**
   * Method of
   *
   * @description
   * The requirements of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<readonly TwoStepRequirement[]>} The requirements.
   */
  public of(userId: string): Promise<readonly TwoStepRequirement[]> {
    return Promise.resolve(this.required.get(userId) ?? []);
  }
  // #endregion
}

/**
 * Function signedIn
 *
 * @description
 * The session of a sign-in that opened one, failing the spec when it answered a challenge.
 *
 * @param {SignInOutcome} outcome - The outcome of the first factor.
 * @returns {SessionIssuedView} The session.
 * @throws {Error} When the outcome is a challenge.
 */
export function signedIn(outcome: SignInOutcome): SessionIssuedView {
  if (outcome.kind !== 'signed-in') {
    throw new Error('The sign-in answered a two-step challenge.');
  }
  return outcome.issued;
}

/**
 * Function challenged
 *
 * @description
 * The challenge of a sign-in that answered one, failing the spec when it opened a session.
 *
 * @param {SignInOutcome} outcome - The outcome of the first factor.
 * @returns {SignInChallengeView} The challenge.
 * @throws {Error} When the outcome is a session.
 */
export function challenged(outcome: SignInOutcome): SignInChallengeView {
  if (outcome.kind !== 'challenge') {
    throw new Error('The sign-in opened a session without a challenge.');
  }
  return outcome.challenge;
}

/**
 * Constant APP_SECRET
 *
 * @description
 * The secret of the authenticator app of a seeded account.
 *
 * @type {string}
 */
export const APP_SECRET: string = 'JBSWY3DPEHPK3PXP';

/**
 * Constant BACKUP_CODES
 *
 * @description
 * The backup codes of a seeded account, as the person wrote them down.
 *
 * @type {readonly string[]}
 */
export const BACKUP_CODES: readonly string[] = ['4F7K-2M9Q', 'R8TX-6WBN', 'H3PD-9ZLC'];

/**
 * Function seedTwoStep
 *
 * @description
 * Turns two-step verification on for an account of the fake database: the app of `APP_SECRET`,
 * confirmed at the instant given, the handle `handle-of-<account>`, and the `BACKUP_CODES` hashed
 * as `FakeBackupCodeSecrets` does.
 *
 * @param {InMemoryAccounts} accounts - The fake database.
 * @param {string} userId - The account.
 * @param {Date} at - When it turned on.
 * @returns {TwoStepVerification} The verification.
 */
export function seedTwoStep(
  accounts: InMemoryAccounts,
  userId: string,
  at: Date,
): TwoStepVerification {
  const verification: TwoStepVerification = TwoStepVerification.enable(
    userId,
    `sealed:${userId}:${APP_SECRET}`,
    FakeTotp.stepAt(at),
    `handle-of-${userId}`,
    at,
  );
  accounts.state.twoStep.set(userId, verification);
  const hashes: FakeBackupCodeSecrets = new FakeBackupCodeSecrets();
  for (const code of BACKUP_CODES) {
    accounts.state.backupCodes.push({
      userId,
      codeHash: hashes.hashOf(userId, code) ?? '',
      usedAt: null,
    });
  }
  return verification;
}
