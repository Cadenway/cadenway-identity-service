import { generateKeyPairSync, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

import { SignedXml } from 'xml-crypto';

export const connection = {
  provider: 'saml',
  organizationId: 'atelier-nord',
  connectionId: 'atelier-nord-sso',
  issuer: 'https://idp.example.test/atelier-nord',
} as const;
export const callbackUrl = 'https://api.example.test/v1/auth/sign-in/federated/saml/callback';
export const serviceProvider = 'https://api.example.test/saml';
export const requestId = '_atelier-nord-saml-request';
export const assertionId = '_atelier-nord-saml-assertion';
export const subject = 'Employee.Camille-42';
const saml2 = 'urn:oasis:names:tc:SAML:2.0';
export const xmlSignature = 'http://www.w3.org/2000/09/xmldsig#';
const rsaSha256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const sha256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const exclusiveCanonicalization = 'http://www.w3.org/2001/10/xml-exc-c14n#';

export interface TestIdp {
  // #region Properties
  /** Synthetic IdP trust anchor. */
  readonly certificate: string;

  /** In-memory signing key corresponding to the certificate. */
  readonly key: KeyObject;
  // #endregion
}

export interface PostOptions {
  /** Assertion identifier, reused by default to exercise replay. */
  readonly assertion?: string;
  // #region Properties
  /** Destination on the response envelope. */
  readonly destination?: string;

  /** Recipient on the assertion's bearer confirmation. */
  readonly recipient?: string;

  /** Issuer on the response and assertion. */
  readonly issuer?: string;

  /** Service-provider audience of the assertion. */
  readonly audience?: string;

  /** Request ID returned by the envelope. */
  readonly request?: string;

  /** Request ID returned by the bearer confirmation. */
  readonly confirmationRequest?: string;

  /** UTC issue time of the response and assertion. */
  readonly issueTime?: string;

  /** UTC expiration of the bearer confirmation. */
  readonly confirmationExpiry?: string;

  /** XML signature algorithm for the fixture signatures. */
  readonly signatureAlgorithm?: string;

  /** XML digest algorithm for the fixture references. */
  readonly digestAlgorithm?: string;

  /** Whether to include a signature on the assertion. */
  readonly signAssertion?: boolean;

  /** Whether to include a signature on the response. */
  readonly signResponse?: boolean;
  // #endregion
}

function der(tag: number, ...parts: Buffer[]): Buffer {
  const data = Buffer.concat(parts);
  const length =
    data.length < 128
      ? [data.length]
      : data.length < 256
        ? [0x81, data.length]
        : [0x82, data.length >>> 8, data.length & 0xff];
  return Buffer.concat([Buffer.from([tag, ...length]), data]);
}

// The verifier takes an X.509 certificate. Build the synthetic self-signed certificate in memory.
export function createTestIdp(): TestIdp {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algorithm = Buffer.from('300d06092a864886f70d01010b0500', 'hex');
  const commonName = der(
    0x30,
    Buffer.from('0603550403', 'hex'),
    der(0x0c, Buffer.from('Test IdP')),
  );
  const name = der(0x30, der(0x31, commonName));
  const validDates = der(
    0x30,
    der(0x18, Buffer.from('20200101000000Z')),
    der(0x18, Buffer.from('20991231235959Z')),
  );
  const body = der(
    0x30,
    Buffer.from('a003020102020101', 'hex'),
    algorithm,
    name,
    validDates,
    name,
    keys.publicKey.export({ format: 'der', type: 'spki' }),
  );
  const fingerprint = sign('sha256', body, keys.privateKey);
  const certificate = der(0x30, body, algorithm, der(0x03, Buffer.from([0]), fingerprint));
  return {
    certificate: `-----BEGIN CERTIFICATE-----\n${certificate.toString('base64')}\n-----END CERTIFICATE-----`,
    key: keys.privateKey,
  };
}

function signedXml(xml: string, localName: string, key: KeyObject, options: PostOptions): string {
  const signer = new SignedXml({
    privateKey: key,
    signatureAlgorithm: options.signatureAlgorithm ?? rsaSha256,
    canonicalizationAlgorithm: exclusiveCanonicalization,
  });
  const root = `/*[local-name(.)='${localName}']`;
  signer.addReference({
    xpath: root,
    transforms: [`${xmlSignature}enveloped-signature`, exclusiveCanonicalization],
    digestAlgorithm: options.digestAlgorithm ?? sha256,
  });
  signer.computeSignature(xml, {
    location: { reference: `${root}/*[local-name(.)='Issuer']`, action: 'after' },
  });
  return signer.getSignedXml();
}

export function signedPost(idp: TestIdp, options: PostOptions = {}): string {
  const now = Date.now();
  const issueTime = options.issueTime ?? new Date(now - 10_000).toISOString();
  const expiry = new Date(now + 120_000).toISOString();
  const request = options.request ?? requestId;
  const issuer = options.issuer ?? connection.issuer;
  const assertion = `<saml:Assertion xmlns:saml="${saml2}:assertion" ID="${options.assertion ?? assertionId}" Version="2.0" IssueInstant="${issueTime}">
    <saml:Issuer>${issuer}</saml:Issuer>
    <saml:Subject>
      <saml:NameID>${subject}</saml:NameID>
      <saml:SubjectConfirmation Method="${saml2}:cm:bearer">
        <saml:SubjectConfirmationData Recipient="${options.recipient ?? callbackUrl}" InResponseTo="${options.confirmationRequest ?? request}" NotOnOrAfter="${options.confirmationExpiry ?? expiry}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${issueTime}" NotOnOrAfter="${expiry}">
      <saml:AudienceRestriction><saml:Audience>${options.audience ?? serviceProvider}</saml:Audience></saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${issueTime}">
      <saml:AuthnContext><saml:AuthnContextClassRef>${saml2}:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>person@example.test</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>
  </saml:Assertion>`;
  const response = `<samlp:Response xmlns:samlp="${saml2}:protocol" xmlns:saml="${saml2}:assertion" ID="_saml-response" Version="2.0" IssueInstant="${issueTime}" Destination="${options.destination ?? callbackUrl}" InResponseTo="${request}">
    <saml:Issuer>${issuer}</saml:Issuer>
    <samlp:Status><samlp:StatusCode Value="${saml2}:status:Success"/></samlp:Status>
    ${options.signAssertion === false ? assertion : signedXml(assertion, 'Assertion', idp.key, options)}
  </samlp:Response>`;
  return Buffer.from(
    options.signResponse === false ? response : signedXml(response, 'Response', idp.key, options),
  ).toString('base64');
}
