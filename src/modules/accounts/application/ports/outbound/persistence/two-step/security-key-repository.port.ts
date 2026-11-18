import type { SecurityKeyRecord } from '../../../../models/two-step/security-key-record.model.js';
import type { VerifiedRegistration } from '../../../../models/two-step/verified-registration.model.js';

/**
 * Interface SecurityKeyRepository
 *
 * @description
 * The security keys of the accounts (`security_keys`).
 */
export interface SecurityKeyRepository {
  // #region Methods
  /**
   * Method listOfUser
   *
   * @description
   * The keys of an account, the oldest first.
   *
   * @param {string} userId - The account.
   * @returns {Promise<SecurityKeyRecord[]>} Its keys, 10 at most.
   */
  listOfUser(userId: string): Promise<SecurityKeyRecord[]>;

  /**
   * Method findOfUser
   *
   * @description
   * A key of an account by its id.
   *
   * @param {string} userId - The account.
   * @param {string} id - The id of the key.
   * @returns {Promise<SecurityKeyRecord | null>} The key, or `null` for a key of another account or an unknown id.
   */
  findOfUser(userId: string, id: string): Promise<SecurityKeyRecord | null>;

  /**
   * Method credentialExists
   *
   * @description
   * Whether a credential id is registered, to any account.
   *
   * @param {string} credentialId - The credential id, base64url.
   * @returns {Promise<boolean>} `true` when a key has it.
   */
  credentialExists(credentialId: string): Promise<boolean>;

  /**
   * Method insert
   *
   * @description
   * Stores a new key of an account.
   *
   * @param {string} userId - The account.
   * @param {string} name - Its name, trimmed.
   * @param {VerifiedRegistration} credential - Its verified credential.
   * @returns {Promise<SecurityKeyRecord>} The stored key, with the id PostgreSQL assigned.
   */
  insert(
    userId: string,
    name: string,
    credential: VerifiedRegistration,
  ): Promise<SecurityKeyRecord>;

  /**
   * Method recordUse
   *
   * @description
   * Records an answer of a key: its counter and its last use.
   *
   * @param {string} id - The id of the key.
   * @param {number} counter - The counter it reported.
   * @param {Date} now - When it answered.
   * @returns {Promise<void>} Resolves once written.
   */
  recordUse(id: string, counter: number, now: Date): Promise<void>;

  /**
   * Method delete
   *
   * @description
   * Deletes a key.
   *
   * @param {string} id - The id of the key.
   * @returns {Promise<void>} Resolves once deleted.
   */
  delete(id: string): Promise<void>;

  /**
   * Method deleteOfUser
   *
   * @description
   * Deletes every key of an account.
   *
   * @param {string} userId - The account.
   * @returns {Promise<void>} Resolves once deleted.
   */
  deleteOfUser(userId: string): Promise<void>;
  // #endregion
}
