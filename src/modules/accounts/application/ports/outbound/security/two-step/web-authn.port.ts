import type { CredentialDescriptor } from '../../../../models/two-step/credential-descriptor.model.js';
import type { SecurityKeyRecord } from '../../../../models/two-step/security-key-record.model.js';
import type { VerifiedAssertion } from '../../../../models/two-step/verified-assertion.model.js';
import type { VerifiedRegistration } from '../../../../models/two-step/verified-registration.model.js';
import type { WebAuthnOptions } from '../../../../models/two-step/web-authn-options.model.js';

/**
 * Interface WebAuthn
 *
 * @description
 * The relying party of the security keys (WebAuthn), on the relying-party id and the exact origins
 * of the environment.
 */
export interface WebAuthn {
  // #region Methods
  /**
   * Method newUserHandle
   *
   * @description
   * Draws the opaque WebAuthn handle of an account, neither its id nor its address.
   *
   * @returns {string} 32 random bytes, base64url.
   */
  newUserHandle(): string;

  /**
   * Method registrationOptions
   *
   * @description
   * The creation options of a new key of the account, excluding its keys.
   *
   * @param {string} userHandle - The handle of the account.
   * @param {string} email - The address of the account, the name of the WebAuthn user.
   * @param {string} name - The full name, its display name.
   * @param {readonly CredentialDescriptor[]} exclude - The keys of the account.
   * @returns {Promise<WebAuthnOptions>} The options and their challenge.
   */
  registrationOptions(
    userHandle: string,
    email: string,
    name: string,
    exclude: readonly CredentialDescriptor[],
  ): Promise<WebAuthnOptions>;

  /**
   * Method verifyRegistration
   *
   * @description
   * Verifies the answer of a browser to creation options: the challenge, the exact origin
   * (cross-origin answers refused), the relying party.
   *
   * @param {Readonly<Record<string, unknown>>} response - `RegistrationResponseJSON`, as the contract validated it.
   * @param {string} expectedChallenge - The challenge of the pending registration.
   * @returns {Promise<VerifiedRegistration | null>} The credential, or `null` for an answer that does not verify.
   */
  verifyRegistration(
    response: Readonly<Record<string, unknown>>,
    expectedChallenge: string,
  ): Promise<VerifiedRegistration | null>;

  /**
   * Method assertionOptions
   *
   * @description
   * The request options of a challenge, allowing the keys of the account only.
   *
   * @param {readonly CredentialDescriptor[]} allow - The keys of the account.
   * @returns {Promise<WebAuthnOptions>} The options and their challenge.
   */
  assertionOptions(allow: readonly CredentialDescriptor[]): Promise<WebAuthnOptions>;

  /**
   * Method verifyAssertion
   *
   * @description
   * Verifies the answer of a key to request options: the challenge, the exact origin (cross-origin
   * answers refused), the relying party, the signature, the counter, and `userHandle`, when
   * present, equal to the handle of the account.
   *
   * @param {Readonly<Record<string, unknown>>} response - `AuthenticationResponseJSON`, as the contract validated it.
   * @param {string} expectedChallenge - The challenge of the latest options.
   * @param {SecurityKeyRecord} key - The key of the account the answer names.
   * @param {string} userHandle - The handle of the account.
   * @returns {Promise<VerifiedAssertion | null>} The new counter, or `null` for an answer that does not verify.
   */
  verifyAssertion(
    response: Readonly<Record<string, unknown>>,
    expectedChallenge: string,
    key: SecurityKeyRecord,
    userHandle: string,
  ): Promise<VerifiedAssertion | null>;
  // #endregion
}
