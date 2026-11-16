import { InvalidEmailAddressError } from '../../errors/accounts/invalid-email-address.error.js';

/**
 * Class EmailAddress
 *
 * @description
 * An email address as this service stores and compares it. Source: the contract
 * (`openapi/internal/identity-service.yaml`, schema `Email`) compares addresses "without regard to
 * case", so the address is trimmed and lowercased once, here: every account, throttle and lockout
 * keyed by an address uses this form, and two spellings of one address are one key.
 */
export class EmailAddress {
  // #region Properties
  /**
   * Property MAX_LENGTH
   *
   * @description
   * Longest address the contract accepts (`maxLength: 254`).
   *
   * @type {number}
   * @readonly
   */
  public static readonly MAX_LENGTH: number = 254;

  /**
   * Property value
   *
   * @description
   * The trimmed, lowercased address.
   *
   * @type {string}
   * @readonly
   */
  public readonly value: string;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Keeps an address already normalized by `of`.
   *
   * @param {string} value - The normalized address.
   * @constructor
   */
  private constructor(value: string) {
    this.value = value;
  }
  // #endregion

  // #region Methods
  /**
   * Method of
   *
   * @description
   * Normalizes an address. The format itself is checked by the validator of the contract before a
   * use case runs; this refuses only what would make a meaningless key.
   *
   * @param {string} raw - The address as the caller sent it.
   * @returns {EmailAddress} The normalized address.
   * @throws {InvalidEmailAddressError} When the address is empty, too long or has no `@`.
   */
  public static of(raw: string): EmailAddress {
    const value: string = raw.trim().toLowerCase();
    if (value.length === 0 || value.length > EmailAddress.MAX_LENGTH || !value.includes('@')) {
      throw new InvalidEmailAddressError();
    }
    return new EmailAddress(value);
  }

  /**
   * Method equals
   *
   * @description
   * Compares two addresses in their normalized form.
   *
   * @param {EmailAddress} other - The other address.
   * @returns {boolean} Whether both name the same address.
   */
  public equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }
  // #endregion
}
