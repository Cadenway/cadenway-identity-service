import { describe, expect, it } from 'vitest';

import type { SecurityKeyRecord } from '../../../application/models/two-step/security-key-record.model.js';
import type { VerifiedRegistration } from '../../../application/models/two-step/verified-registration.model.js';
import type { WebAuthnOptions } from '../../../application/models/two-step/web-authn-options.model.js';
import { SimpleWebAuthn } from './simple-web-authn.adapter.js';
import { SoftwareAuthenticator } from './software-authenticator.fixture.js';

/**
 * Constant RP_ID
 *
 * @description
 * The relying party of the local stack (`WEBAUTHN_RP_ID`).
 *
 * @type {string}
 */
const RP_ID: string = 'app.cadenway.localhost';

/**
 * Constant ORIGIN
 *
 * @description
 * The origin of the web application of the local stack (`WEBAUTHN_ORIGINS`).
 *
 * @type {string}
 */
const ORIGIN: string = 'http://app.cadenway.localhost';

/**
 * Function registered
 *
 * @description
 * Registers the credential of an authenticator with the relying party.
 *
 * @param {SimpleWebAuthn} webAuthn - The relying party.
 * @param {SoftwareAuthenticator} authenticator - The authenticator.
 * @param {string} userHandle - The handle of the account.
 * @returns {Promise<SecurityKeyRecord>} The stored key.
 */
async function registered(
  webAuthn: SimpleWebAuthn,
  authenticator: SoftwareAuthenticator,
  userHandle: string,
): Promise<SecurityKeyRecord> {
  const options: WebAuthnOptions = await webAuthn.registrationOptions(
    userHandle,
    'camille.martin@ateliernord.fr',
    'Camille Martin',
    [],
  );
  const verified: VerifiedRegistration | null = await webAuthn.verifyRegistration(
    authenticator.register(options.options),
    options.challenge,
  );
  if (verified === null) {
    throw new Error('The registration did not verify.');
  }
  return {
    id: '019a6c52-1d2e-7f3a-8b4c-5d6e7f8a9b01',
    name: 'YubiKey 5C NFC',
    credentialId: verified.credentialId,
    publicKey: verified.publicKey,
    counter: verified.counter,
    transports: verified.transports,
    createdAt: new Date('2026-11-09T13:12:00Z'),
    lastUsedAt: null,
  };
}

describe('SimpleWebAuthn', () => {
  const webAuthn: SimpleWebAuthn = new SimpleWebAuthn(RP_ID, [ORIGIN]);

  it('offers the local relying party, the algorithms and the excluded keys', async () => {
    const options: WebAuthnOptions = await webAuthn.registrationOptions(
      webAuthn.newUserHandle(),
      'camille.martin@ateliernord.fr',
      'Camille Martin',
      [{ id: 'ExampleOnlyCredentialId', transports: ['usb', 'nfc'] }],
    );

    expect(options.options).toMatchObject({
      challenge: options.challenge,
      rp: { id: RP_ID, name: 'Cadenway' },
      user: { name: 'camille.martin@ateliernord.fr', displayName: 'Camille Martin' },
      attestation: 'none',
      excludeCredentials: [{ id: 'ExampleOnlyCredentialId', type: 'public-key' }],
    });
  });

  it('registers a key of the local relying party from the origin http://app.cadenway.localhost', async () => {
    const authenticator: SoftwareAuthenticator = new SoftwareAuthenticator(RP_ID, ORIGIN);
    const key: SecurityKeyRecord = await registered(
      webAuthn,
      authenticator,
      webAuthn.newUserHandle(),
    );

    expect(key).toMatchObject({
      credentialId: authenticator.credentialId,
      counter: 0,
      transports: ['usb'],
    });
  });

  it('verifies an assertion of the key, with its user handle, and returns the new counter', async () => {
    const authenticator: SoftwareAuthenticator = new SoftwareAuthenticator(RP_ID, ORIGIN);
    const handle: string = webAuthn.newUserHandle();
    const key: SecurityKeyRecord = await registered(webAuthn, authenticator, handle);
    const options: WebAuthnOptions = await webAuthn.assertionOptions([
      { id: key.credentialId, transports: key.transports },
    ]);

    await expect(
      webAuthn.verifyAssertion(
        authenticator.assert(options.options, handle),
        options.challenge,
        key,
        handle,
      ),
    ).resolves.toEqual({ newCounter: 1 });
    await expect(
      webAuthn.verifyAssertion(
        authenticator.assert(options.options, null),
        options.challenge,
        key,
        handle,
      ),
    ).resolves.toEqual({ newCounter: 2 });
  });

  it('refuses an assertion from another origin, a cross-origin frame or for another challenge', async () => {
    const authenticator: SoftwareAuthenticator = new SoftwareAuthenticator(RP_ID, ORIGIN);
    const handle: string = webAuthn.newUserHandle();
    const key: SecurityKeyRecord = await registered(webAuthn, authenticator, handle);
    const options: WebAuthnOptions = await webAuthn.assertionOptions([
      { id: key.credentialId, transports: key.transports },
    ]);

    for (const overrides of [
      { origin: 'http://evil.cadenway.localhost' },
      { origin: 'http://app.cadenway.localhost:8080' },
      { origin: 'https://app.cadenway.localhost' },
      { crossOrigin: true },
      { topOrigin: 'https://evil.example' },
    ]) {
      await expect(
        webAuthn.verifyAssertion(
          authenticator.assert(options.options, handle, overrides),
          options.challenge,
          key,
          handle,
        ),
      ).resolves.toBeNull();
    }
    await expect(
      webAuthn.verifyAssertion(
        authenticator.assert(options.options, handle),
        'another-challenge',
        key,
        handle,
      ),
    ).resolves.toBeNull();
  });

  it('refuses an assertion of another handle, or of a key the record does not name', async () => {
    const authenticator: SoftwareAuthenticator = new SoftwareAuthenticator(RP_ID, ORIGIN);
    const handle: string = webAuthn.newUserHandle();
    const key: SecurityKeyRecord = await registered(webAuthn, authenticator, handle);
    const options: WebAuthnOptions = await webAuthn.assertionOptions([
      { id: key.credentialId, transports: key.transports },
    ]);
    const other: SoftwareAuthenticator = new SoftwareAuthenticator(RP_ID, ORIGIN);

    await expect(
      webAuthn.verifyAssertion(
        authenticator.assert(options.options, webAuthn.newUserHandle()),
        options.challenge,
        key,
        handle,
      ),
    ).resolves.toBeNull();
    await expect(
      webAuthn.verifyAssertion(
        other.assert(options.options, handle),
        options.challenge,
        key,
        handle,
      ),
    ).resolves.toBeNull();
  });

  it('refuses a registration from another origin or a cross-origin frame', async () => {
    const authenticator: SoftwareAuthenticator = new SoftwareAuthenticator(RP_ID, ORIGIN);
    const options: WebAuthnOptions = await webAuthn.registrationOptions(
      webAuthn.newUserHandle(),
      'camille.martin@ateliernord.fr',
      'Camille Martin',
      [],
    );

    for (const overrides of [
      { origin: 'http://cadenway.localhost' },
      { crossOrigin: true },
      { topOrigin: 'https://evil.example' },
    ]) {
      await expect(
        webAuthn.verifyRegistration(
          authenticator.register(options.options, overrides),
          options.challenge,
        ),
      ).resolves.toBeNull();
    }
  });

  it('refuses a credential of another relying party', async () => {
    const authenticator: SoftwareAuthenticator = new SoftwareAuthenticator(
      'cadenway.localhost',
      ORIGIN,
    );
    const options: WebAuthnOptions = await webAuthn.registrationOptions(
      webAuthn.newUserHandle(),
      'camille.martin@ateliernord.fr',
      'Camille Martin',
      [],
    );

    await expect(
      webAuthn.verifyRegistration(authenticator.register(options.options), options.challenge),
    ).resolves.toBeNull();
  });
});
