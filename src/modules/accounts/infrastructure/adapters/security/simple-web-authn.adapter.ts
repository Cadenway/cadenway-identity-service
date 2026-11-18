import { randomBytes } from 'node:crypto';

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server';

import type { CredentialDescriptor } from '../../../application/models/two-step/credential-descriptor.model.js';
import type { SecurityKeyRecord } from '../../../application/models/two-step/security-key-record.model.js';
import type { VerifiedAssertion } from '../../../application/models/two-step/verified-assertion.model.js';
import type { VerifiedRegistration } from '../../../application/models/two-step/verified-registration.model.js';
import type { WebAuthnOptions } from '../../../application/models/two-step/web-authn-options.model.js';
import type { WebAuthn } from '../../../application/ports/outbound/security/two-step/web-authn.port.js';

/**
 * Constant TIMEOUT_MS
 *
 * @description
 * How long a browser waits for a key: 5 minutes, the life of the options.
 *
 * @type {number}
 */
const TIMEOUT_MS: number = 300_000;

/**
 * Constant ALGORITHMS
 *
 * @description
 * The COSE algorithms offered: EdDSA, ES256, RS256, as the contract's example lists them.
 *
 * @type {number[]}
 */
const ALGORITHMS: number[] = [-8, -7, -257];

/**
 * Function transportsOf
 *
 * @description
 * Keeps the transports a browser may name, as `@simplewebauthn/server` types them.
 *
 * @param {readonly string[]} transports - The stored transports.
 * @returns {AuthenticatorTransport[]} The transports.
 */
function transportsOf(transports: readonly string[]): AuthenticatorTransport[] {
  const known: readonly string[] = [
    'ble',
    'cable',
    'hybrid',
    'internal',
    'nfc',
    'smart-card',
    'usb',
  ];
  return transports.filter((transport: string): boolean =>
    known.includes(transport),
  ) as AuthenticatorTransport[];
}

/**
 * Class SimpleWebAuthn
 *
 * @description
 * `WebAuthn` with `@simplewebauthn/server` 14, for the relying party `WEBAUTHN_RP_ID` and the
 * exact origins `WEBAUTHN_ORIGINS` (decision 7 of P2c, `cw-identity-security`):
 *
 * - registration options with `residentKey: 'preferred'`, `userVerification: 'preferred'`,
 *   attestation `none`, the keys of the account excluded; request options allowing the keys of the
 *   account only, `userVerification: 'preferred'`;
 * - user verification is preferred, not required (`requireUserVerification: false`): a key that
 *   only proves presence answers, as the contract's options say;
 * - before the library runs, the `clientDataJSON` of the answer is read: its `type` must be the
 *   expected one, `crossOrigin` must not be `true`, `topOrigin` must be absent, and `origin` must
 *   be one of the origins exactly, never by suffix or pattern; the library then checks the
 *   challenge, the origin again, the hash of the relying party, the signature and the counter;
 * - an assertion names the key of the account it answers with (`id`), and its `userHandle`, when
 *   present, must be the handle of the account;
 * - any error of the library, or of the decoding, is an answer that does not verify.
 */
export class SimpleWebAuthn implements WebAuthn {
  // #region Properties
  /**
   * Property rpId
   *
   * @description
   * The relying-party id.
   *
   * @type {string}
   * @readonly
   */
  private readonly rpId: string;

  /**
   * Property origins
   *
   * @description
   * The exact origins a key may answer from.
   *
   * @type {readonly string[]}
   * @readonly
   */
  private readonly origins: readonly string[];
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the relying party of the environment.
   *
   * @param {string} rpId - `WEBAUTHN_RP_ID`.
   * @param {readonly string[]} origins - `WEBAUTHN_ORIGINS`.
   * @constructor
   */
  public constructor(rpId: string, origins: readonly string[]) {
    this.rpId = rpId;
    this.origins = origins;
  }
  // #endregion

  // #region Methods
  /**
   * Method newUserHandle
   *
   * @description
   * Draws 32 random bytes.
   *
   * @returns {string} The handle, base64url.
   */
  public newUserHandle(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Method registrationOptions
   *
   * @description
   * Generates the creation options of a new key.
   *
   * @param {string} userHandle - The handle of the account.
   * @param {string} email - Its address.
   * @param {string} name - Its full name.
   * @param {readonly CredentialDescriptor[]} exclude - Its keys.
   * @returns {Promise<WebAuthnOptions>} The options and their challenge.
   */
  public async registrationOptions(
    userHandle: string,
    email: string,
    name: string,
    exclude: readonly CredentialDescriptor[],
  ): Promise<WebAuthnOptions> {
    const options = await generateRegistrationOptions({
      rpName: 'Cadenway',
      rpID: this.rpId,
      userName: email,
      userID: new Uint8Array(Buffer.from(userHandle, 'base64url')),
      userDisplayName: name,
      timeout: TIMEOUT_MS,
      attestationType: 'none',
      excludeCredentials: exclude.map((key: CredentialDescriptor) => ({
        id: key.id,
        transports: transportsOf(key.transports),
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      supportedAlgorithmIDs: ALGORITHMS,
    });
    return { options: { ...options }, challenge: options.challenge };
  }

  /**
   * Method verifyRegistration
   *
   * @description
   * Verifies the answer of a browser to creation options.
   *
   * @param {Readonly<Record<string, unknown>>} response - `RegistrationResponseJSON`.
   * @param {string} expectedChallenge - The challenge of the pending registration.
   * @returns {Promise<VerifiedRegistration | null>} The credential, or `null`.
   */
  public async verifyRegistration(
    response: Readonly<Record<string, unknown>>,
    expectedChallenge: string,
  ): Promise<VerifiedRegistration | null> {
    if (!this.isSameOriginAnswer(response, 'webauthn.create')) {
      return null;
    }
    let verified: VerifiedRegistrationResponse;
    try {
      verified = await verifyRegistrationResponse({
        response: response as unknown as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: [...this.origins],
        expectedRPID: this.rpId,
        requireUserVerification: false,
        supportedAlgorithmIDs: ALGORITHMS,
      });
    } catch {
      return null;
    }
    if (!verified.verified) {
      return null;
    }
    const { credential, credentialDeviceType, credentialBackedUp, userVerified } =
      verified.registrationInfo;
    return {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? [],
      backupEligible: credentialDeviceType === 'multiDevice',
      backedUp: credentialBackedUp,
      userVerified,
    };
  }

  /**
   * Method assertionOptions
   *
   * @description
   * Generates the request options of a challenge.
   *
   * @param {readonly CredentialDescriptor[]} allow - The keys of the account.
   * @returns {Promise<WebAuthnOptions>} The options and their challenge.
   */
  public async assertionOptions(allow: readonly CredentialDescriptor[]): Promise<WebAuthnOptions> {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      allowCredentials: allow.map((key: CredentialDescriptor) => ({
        id: key.id,
        transports: transportsOf(key.transports),
      })),
      userVerification: 'preferred',
      timeout: TIMEOUT_MS,
    });
    return { options: { ...options }, challenge: options.challenge };
  }

  /**
   * Method verifyAssertion
   *
   * @description
   * Verifies the answer of a key to request options.
   *
   * @param {Readonly<Record<string, unknown>>} response - `AuthenticationResponseJSON`.
   * @param {string} expectedChallenge - The challenge of the latest options.
   * @param {SecurityKeyRecord} key - The key of the account the answer names.
   * @param {string} userHandle - The handle of the account.
   * @returns {Promise<VerifiedAssertion | null>} The new counter, or `null`.
   */
  public async verifyAssertion(
    response: Readonly<Record<string, unknown>>,
    expectedChallenge: string,
    key: SecurityKeyRecord,
    userHandle: string,
  ): Promise<VerifiedAssertion | null> {
    const answer: AuthenticationResponseJSON = response as unknown as AuthenticationResponseJSON;
    if (
      !this.isSameOriginAnswer(response, 'webauthn.get') ||
      answer.id !== key.credentialId ||
      (typeof answer.response.userHandle === 'string' &&
        answer.response.userHandle !== '' &&
        answer.response.userHandle !== userHandle)
    ) {
      return null;
    }
    let verified: VerifiedAuthenticationResponse;
    try {
      verified = await verifyAuthenticationResponse({
        response: answer,
        expectedChallenge,
        expectedOrigin: [...this.origins],
        expectedRPID: this.rpId,
        credential: {
          id: key.credentialId,
          publicKey: new Uint8Array(Buffer.from(key.publicKey, 'base64url')),
          counter: key.counter,
          transports: transportsOf(key.transports),
        },
        requireUserVerification: false,
      });
    } catch {
      return null;
    }
    return verified.verified ? { newCounter: verified.authenticationInfo.newCounter } : null;
  }

  /**
   * Method isSameOriginAnswer
   *
   * @description
   * Reads the `clientDataJSON` of an answer: its type, and an origin of the list exactly, neither
   * cross-origin nor in a frame of another site.
   *
   * @param {Readonly<Record<string, unknown>>} response - The answer.
   * @param {'webauthn.create' | 'webauthn.get'} type - The expected type.
   * @returns {boolean} `true` when the answer may be verified.
   */
  private isSameOriginAnswer(
    response: Readonly<Record<string, unknown>>,
    type: 'webauthn.create' | 'webauthn.get',
  ): boolean {
    const inner: unknown = response.response;
    if (typeof inner !== 'object' || inner === null) {
      return false;
    }
    const encoded: unknown = (inner as Record<string, unknown>).clientDataJSON;
    // Strict base64url, so this check and the library read the same bytes.
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(encoded)) {
      return false;
    }
    let clientData: unknown;
    try {
      clientData = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return false;
    }
    if (typeof clientData !== 'object' || clientData === null) {
      return false;
    }
    const data: Record<string, unknown> = clientData as Record<string, unknown>;
    return (
      data.type === type &&
      data.crossOrigin !== true &&
      data.topOrigin === undefined &&
      typeof data.origin === 'string' &&
      this.origins.includes(data.origin)
    );
  }
  // #endregion
}
