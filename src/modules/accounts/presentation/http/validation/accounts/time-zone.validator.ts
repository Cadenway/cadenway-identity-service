/**
 * Constant SUPPORTED_TIME_ZONES
 *
 * @description
 * The canonical IANA time zone names the runtime knows (`Intl.supportedValuesOf`), with `UTC`.
 *
 * @type {ReadonlySet<string>}
 */
const SUPPORTED_TIME_ZONES: ReadonlySet<string> = new Set<string>([
  ...Intl.supportedValuesOf('timeZone'),
  'UTC',
]);

/**
 * Constant IANA_NAME
 *
 * @description
 * The shape of an IANA name (`Area/Location`, `Etc/GMT+1`, `UTC`): letters, digits, `_`, `+` and
 * `-` in segments separated by `/`. It leaves out the UTC offsets (`+01:00`) the runtime also
 * accepts as a time zone, which are not IANA names.
 *
 * @type {RegExp}
 */
const IANA_NAME: RegExp = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/u;

/**
 * Function isIanaTimeZone
 *
 * @description
 * Whether a value is an IANA time zone name the runtime knows, canonical (`Europe/Paris`) or a link
 * a browser may report (`Asia/Calcutta`), as `PATCH /v1/me` requires of `timeZone`
 * (`openapi/public/auth.yaml`: "a name identity-service does not know answers
 * `400 request.invalid`").
 *
 * @param {string} value - The time zone as sent.
 * @returns {boolean} Whether it is known.
 */
export function isIanaTimeZone(value: string): boolean {
  if (SUPPORTED_TIME_ZONES.has(value)) {
    return true;
  }
  if (!IANA_NAME.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
