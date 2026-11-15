import type { CompromisedPasswords } from '../../application/ports/compromised-passwords.port.js';

/**
 * Constant OBVIOUSLY_WEAK_PASSWORDS
 *
 * @description
 * A short list written for this repository, not taken from any leaked corpus: passwords of 12
 * characters or more (shorter ones are refused by the length rule anyway) that are keyboard runs,
 * repetitions, or a common word with a counter. It stands in for the embedded list of compromised
 * passwords until its provenance is decided (open point of `cw-identity-security`); the port lets a
 * full list replace it without touching a use case. Entries are lowercase.
 *
 * @type {ReadonlySet<string>}
 */
const OBVIOUSLY_WEAK_PASSWORDS: ReadonlySet<string> = new Set<string>([
  '000000000000',
  '111111111111',
  '123123123123',
  '123456123456',
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123456789abc',
  '1q2w3e4r5t6y',
  'aaaaaaaaaaaa',
  'abcdefghijkl',
  'abc123abc123',
  'administrator',
  'azerty123456',
  'azertyuiop12',
  'azertyuiop123',
  'azertyuiopqs',
  'bonjour12345',
  'cadenway1234',
  'cadenway2026',
  'changeme1234',
  'iloveyou1234',
  'letmein12345',
  'motdepasse12',
  'motdepasse123',
  'motdepasse1234',
  'password1234',
  'password12345',
  'passwordpassword',
  'qwerty123456',
  'qwertyuiop12',
  'qwertyuiop123',
  'qwertyuiopas',
  'soleil123456',
  'welcome12345',
]);

/**
 * Class EmbeddedCompromisedPasswords
 *
 * @description
 * `CompromisedPasswords` on the list above, compared after NFC normalization and lowercasing, so
 * `Password1234` is refused as `password1234` is.
 */
export class EmbeddedCompromisedPasswords implements CompromisedPasswords {
  // #region Methods
  /**
   * Method includes
   *
   * @description
   * Whether a password is in the list.
   *
   * @param {string} password - The password as typed.
   * @returns {Promise<boolean>} Whether it is in the list.
   */
  public includes(password: string): Promise<boolean> {
    return Promise.resolve(OBVIOUSLY_WEAK_PASSWORDS.has(password.normalize('NFC').toLowerCase()));
  }
  // #endregion
}
