/**
 * Constant TRUSTED_DEVICE_LIFETIME_MS
 *
 * @description
 * How long a browser stays a trusted device of an account: 30 days ("Faire confiance à cet appareil
 * pendant 30 jours", decision 7 of P2c), the `Max-Age=2592000` of `__Host-cw_trusted_device`.
 *
 * @type {number}
 */
export const TRUSTED_DEVICE_LIFETIME_MS: number = 30 * 24 * 60 * 60_000;

/**
 * Constant MAX_TRUSTED_DEVICES
 *
 * @description
 * How many trusted devices an account keeps at most: trusting an eleventh browser forgets the one
 * trusted first, so a browser that trusts itself again and again does not make the rows grow.
 *
 * @type {number}
 */
export const MAX_TRUSTED_DEVICES: number = 10;
