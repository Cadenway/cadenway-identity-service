import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import type { JsonWebKey, KeyObject } from 'node:crypto';

import { isoCBOR } from '@simplewebauthn/server/helpers';

/**
 * Interface ClientDataOverrides
 *
 * @description
 * What a spec changes in the `clientDataJSON` a software authenticator signs, to play a phishing
 * page or a cross-origin frame.
 */
interface ClientDataOverrides {
  // #region Properties
  /**
   * Property origin
   *
   * @description
   * The origin the browser reports, the one of the authenticator by default.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly origin?: string | undefined;

  /**
   * Property crossOrigin
   *
   * @description
   * Whether the browser reports a cross-origin call, `false` by default.
   *
   * @type {boolean | undefined}
   * @readonly
   */
  readonly crossOrigin?: boolean | undefined;

  /**
   * Property topOrigin
   *
   * @description
   * The origin of the top-level page of a cross-origin frame, absent by default.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly topOrigin?: string | undefined;
  // #endregion
}

/**
 * Function base64url
 *
 * @description
 * The base64url text of bytes, without padding, as WebAuthn JSON carries them.
 *
 * @param {Uint8Array} bytes - The bytes.
 * @returns {string} The text.
 */
function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Class SoftwareAuthenticator
 *
 * @description
 * A WebAuthn authenticator in memory for the specs: one ES256 (P-256) credential, attestation
 * `none`, user presence without user verification, a signature counter that goes up by one per
 * assertion, and the JSON a browser hands to the relying party (`RegistrationResponseJSON`,
 * `AuthenticationResponseJSON`). Nothing leaves the process.
 */
export class SoftwareAuthenticator {
  // #region Properties
  /**
   * Property credentialId
   *
   * @description
   * The base64url id of the credential.
   *
   * @type {string}
   * @readonly
   */
  public readonly credentialId: string = base64url(randomBytes(16));

  /**
   * Property rpId
   *
   * @description
   * The relying party the credential belongs to.
   *
   * @type {string}
   * @readonly
   */
  private readonly rpId: string;

  /**
   * Property origin
   *
   * @description
   * The origin of the web application the browser reports.
   *
   * @type {string}
   * @readonly
   */
  private readonly origin: string;

  /**
   * Property privateKey
   *
   * @description
   * The private key of the credential.
   *
   * @type {KeyObject}
   * @readonly
   */
  private readonly privateKey: KeyObject;

  /**
   * Property publicJwk
   *
   * @description
   * The public key of the credential, as a JWK.
   *
   * @type {JsonWebKey}
   * @readonly
   */
  private readonly publicJwk: JsonWebKey;

  /**
   * Property counter
   *
   * @description
   * The signature counter.
   *
   * @type {number}
   */
  private counter: number = 0;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Creates the credential for a relying party and the origin of its web application.
   *
   * @param {string} rpId - The relying party, `app.cadenway.localhost` locally.
   * @param {string} origin - The origin, `http://app.cadenway.localhost` locally.
   * @constructor
   */
  public constructor(rpId: string, origin: string) {
    this.rpId = rpId;
    this.origin = origin;
    const pair: { readonly privateKey: KeyObject; readonly publicKey: KeyObject } =
      generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = pair.privateKey;
    this.publicJwk = pair.publicKey.export({ format: 'jwk' });
  }
  // #endregion

  // #region Methods
  /**
   * Method register
   *
   * @description
   * Answers WebAuthn creation options (`navigator.credentials.create`).
   *
   * @param {Readonly<Record<string, unknown>>} options - The options of the relying party.
   * @param {ClientDataOverrides} overrides - What the browser reports differently.
   * @returns {Record<string, unknown>} The `RegistrationResponseJSON`.
   */
  public register(
    options: Readonly<Record<string, unknown>>,
    overrides: ClientDataOverrides = {},
  ): Record<string, unknown> {
    const clientDataJSON: Buffer = this.clientData('webauthn.create', options, overrides);
    const credentialId: Buffer = Buffer.from(this.credentialId, 'base64url');
    const length: Buffer = Buffer.alloc(2);
    length.writeUInt16BE(credentialId.length);
    const authData: Buffer = Buffer.concat([
      this.header(0x41, 0),
      Buffer.alloc(16),
      length,
      credentialId,
      Buffer.from(this.coseKey()),
    ]);
    const attestationObject: Uint8Array = isoCBOR.encode(
      new Map<string, string | Map<string, never> | Uint8Array>([
        ['fmt', 'none'],
        ['attStmt', new Map<string, never>()],
        ['authData', new Uint8Array(authData)],
      ]),
    );
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      response: {
        clientDataJSON: base64url(clientDataJSON),
        attestationObject: base64url(attestationObject),
        transports: ['usb'],
      },
      authenticatorAttachment: 'cross-platform',
      clientExtensionResults: {},
    };
  }

  /**
   * Method assert
   *
   * @description
   * Answers WebAuthn request options (`navigator.credentials.get`), signed with the credential.
   *
   * @param {Readonly<Record<string, unknown>>} options - The options of the relying party.
   * @param {string | null} userHandle - The handle the credential reports, `null` for none.
   * @param {ClientDataOverrides} overrides - What the browser reports differently.
   * @returns {Record<string, unknown>} The `AuthenticationResponseJSON`.
   */
  public assert(
    options: Readonly<Record<string, unknown>>,
    userHandle: string | null,
    overrides: ClientDataOverrides = {},
  ): Record<string, unknown> {
    this.counter += 1;
    const clientDataJSON: Buffer = this.clientData('webauthn.get', options, overrides);
    const authData: Buffer = this.header(0x01, this.counter);
    const signature: Buffer = sign(
      'sha256',
      Buffer.concat([authData, createHash('sha256').update(clientDataJSON).digest()]),
      this.privateKey,
    );
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      response: {
        clientDataJSON: base64url(clientDataJSON),
        authenticatorData: base64url(authData),
        signature: base64url(signature),
        ...(userHandle === null ? {} : { userHandle }),
      },
      authenticatorAttachment: 'cross-platform',
      clientExtensionResults: {},
    };
  }

  /**
   * Method clientData
   *
   * @description
   * The `clientDataJSON` of a ceremony.
   *
   * @param {'webauthn.create' | 'webauthn.get'} type - The ceremony.
   * @param {Readonly<Record<string, unknown>>} options - The options, for their challenge.
   * @param {ClientDataOverrides} overrides - What the browser reports differently.
   * @returns {Buffer} The bytes.
   */
  private clientData(
    type: 'webauthn.create' | 'webauthn.get',
    options: Readonly<Record<string, unknown>>,
    overrides: ClientDataOverrides,
  ): Buffer {
    return Buffer.from(
      JSON.stringify({
        type,
        challenge: options.challenge,
        origin: overrides.origin ?? this.origin,
        crossOrigin: overrides.crossOrigin ?? false,
        ...(overrides.topOrigin === undefined ? {} : { topOrigin: overrides.topOrigin }),
      }),
    );
  }

  /**
   * Method header
   *
   * @description
   * The first 37 bytes of the authenticator data: the hash of the relying party, the flags and
   * the counter.
   *
   * @param {number} flags - The flags (user present `0x01`, attested credential `0x40`).
   * @param {number} counter - The signature counter.
   * @returns {Buffer} The bytes.
   */
  private header(flags: number, counter: number): Buffer {
    const count: Buffer = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    return Buffer.concat([
      createHash('sha256').update(this.rpId).digest(),
      Buffer.from([flags]),
      count,
    ]);
  }

  /**
   * Method coseKey
   *
   * @description
   * The public key in COSE (EC2, ES256, P-256), as the attested credential data carries it.
   *
   * @returns {Uint8Array} The CBOR bytes.
   */
  private coseKey(): Uint8Array {
    return isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, new Uint8Array(Buffer.from(this.publicJwk.x ?? '', 'base64url'))],
        [-3, new Uint8Array(Buffer.from(this.publicJwk.y ?? '', 'base64url'))],
      ]),
    );
  }
  // #endregion
}
