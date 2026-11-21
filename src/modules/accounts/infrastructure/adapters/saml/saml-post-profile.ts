import { DOMParser } from '@xmldom/xmldom';

import type { SamlAssertionVerificationInput } from './saml-assertion-verification.input.js';

const protocol = 'urn:oasis:names:tc:SAML:2.0:protocol';
const assertion = 'urn:oasis:names:tc:SAML:2.0:assertion';
const bearer = 'urn:oasis:names:tc:SAML:2.0:cm:bearer';
const assertionConditions = new Set(['AudienceRestriction', 'OneTimeUse', 'ProxyRestriction']);
const signature = 'http://www.w3.org/2000/09/xmldsig#';
const canonicalizationAlgorithms = new Set([
  'http://www.w3.org/2001/10/xml-exc-c14n#',
  'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
]);
const signatureAlgorithms = new Set([
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1',
]);
const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Clock skew in milliseconds allowed for SAML time conditions. */
export const samlClockSkewMs = 60_000;

/** Assertion age in milliseconds before clock-skew allowance. */
export const samlAssertionMaxAgeMs = 5 * 60_000;

function refuse(): never {
  throw new Error('The SAML response does not match the sign-in profile.');
}

function children(parent: Element): Element[] {
  const elements: Element[] = [];
  for (let child = parent.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === 1) elements.push(child as Element);
  }
  return elements;
}

function namedChildren(parent: Element, localName: string, namespace: string): Element[] {
  const matching = children(parent).filter((child) => child.localName === localName);
  if (matching.some((child) => child.namespaceURI !== namespace)) refuse();
  return matching;
}

function onlyChild(parent: Element, localName: string, namespace: string): Element {
  const [element, extra] = namedChildren(parent, localName, namespace);
  if (element === undefined || extra !== undefined) refuse();
  return element;
}

function textValue(element: Element): string {
  const value = element.textContent;
  if (value.trim().length === 0 || children(element).length !== 0) refuse();
  return value;
}

function parseRoot(xml: string, localName: string, namespace: string): Element {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(xml)) refuse();
  const document = new DOMParser({
    errorHandler: { warning: refuse, error: refuse, fatalError: refuse },
  }).parseFromString(xml, 'text/xml');
  const root = document.documentElement;
  if (root.localName !== localName || root.namespaceURI !== namespace) refuse();
  const pending: { element: Element; depth: number }[] = [{ element: root, depth: 1 }];
  for (const { element, depth } of pending) {
    if (depth > 64) refuse();
    for (const child of children(element)) pending.push({ element: child, depth: depth + 1 });
  }
  return root;
}

function identifier(element: Element): string {
  const value = attribute(element, 'ID');
  if (value === null || !/^[A-Za-z_][A-Za-z0-9._-]{0,255}$/u.test(value)) refuse();
  return value;
}

function attribute(element: Element, name: string): string | null {
  const [match, extra] = Array.from(element.attributes).filter((item) => item.localName === name);
  if (extra !== undefined || (match?.namespaceURI ?? null) !== null) refuse();
  return match?.value ?? null;
}

// The library also searches by local name, so check for alternate names and namespaces before it runs.
function assertSingleDescendant(parent: Element, node: Element): void {
  const matches = Array.from(parent.getElementsByTagName('*')).filter(
    (candidate) => candidate.localName === node.localName,
  );
  if (matches.length !== 1 || matches[0] !== node) refuse();
}

function assertSignatureProfile(signed: Element): void {
  const signatureNode = onlyChild(signed, 'Signature', signature);
  const signedInfo = onlyChild(signatureNode, 'SignedInfo', signature);
  const canonicalization = onlyChild(signedInfo, 'CanonicalizationMethod', signature);
  const method = onlyChild(signedInfo, 'SignatureMethod', signature);
  assertSingleDescendant(signatureNode, canonicalization);
  assertSingleDescendant(signatureNode, method);
  const reference = onlyChild(signedInfo, 'Reference', signature);
  const digest = onlyChild(reference, 'DigestMethod', signature);
  const transforms = namedChildren(
    onlyChild(reference, 'Transforms', signature),
    'Transform',
    signature,
  ).map((transform) => attribute(transform, 'Algorithm') ?? '');
  if (
    !canonicalizationAlgorithms.has(attribute(canonicalization, 'Algorithm') ?? '') ||
    !signatureAlgorithms.has(attribute(method, 'Algorithm') ?? '') ||
    attribute(digest, 'Algorithm') !== 'http://www.w3.org/2001/04/xmlenc#sha256' ||
    attribute(reference, 'URI') !== `#${identifier(signed)}` ||
    transforms[0] !== `${signature}enveloped-signature` ||
    transforms.length > 2 ||
    transforms.slice(1).some((transform) => !canonicalizationAlgorithms.has(transform))
  ) {
    refuse();
  }
}

function timestamp(value: string | null): number {
  if (value === null || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)) {
    refuse();
  }
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 19) !== value.slice(0, 19)
  ) {
    refuse();
  }
  return parsed;
}

function assertIssuedRecently(element: Element, now: number): void {
  const issuedAt = timestamp(element.getAttribute('IssueInstant'));
  if (
    issuedAt > now + samlClockSkewMs ||
    now - samlClockSkewMs >= issuedAt + samlAssertionMaxAgeMs
  ) {
    refuse();
  }
}

function hasValidBearerConfirmation(
  subject: Element,
  input: SamlAssertionVerificationInput,
  now: number,
): boolean {
  return namedChildren(subject, 'SubjectConfirmation', assertion).some((confirmation) => {
    if (confirmation.getAttribute('Method') !== bearer) return false;
    const data = onlyChild(confirmation, 'SubjectConfirmationData', assertion);
    return (
      data.getAttribute('Recipient') === input.binding.assertionConsumerUrl &&
      data.getAttribute('InResponseTo') === input.requestId &&
      !data.hasAttribute('NotBefore') &&
      timestamp(data.getAttribute('NotOnOrAfter')) > now - samlClockSkewMs
    );
  });
}

function allowsAudience(conditions: Element, audience: string): boolean {
  const restrictions = namedChildren(conditions, 'AudienceRestriction', assertion);
  return (
    restrictions.length !== 0 &&
    restrictions.every((restriction) =>
      namedChildren(restriction, 'Audience', assertion).some(
        (item) => textValue(item) === audience,
      ),
    )
  );
}

function isCurrentAuthentication(statement: Element, now: number): boolean {
  const expiresAt = attribute(statement, 'SessionNotOnOrAfter');
  return (
    timestamp(statement.getAttribute('AuthnInstant')) <= now + samlClockSkewMs &&
    (expiresAt === null || timestamp(expiresAt) > now - samlClockSkewMs)
  );
}

function readAssertionSubject(
  node: Element,
  input: SamlAssertionVerificationInput,
  now: number,
): string {
  const subject = onlyChild(node, 'Subject', assertion);
  const nameId = onlyChild(subject, 'NameID', assertion);
  const statements = namedChildren(node, 'AuthnStatement', assertion);
  const conditions = onlyChild(node, 'Conditions', assertion);
  if (
    node.getAttribute('Version') !== '2.0' ||
    textValue(onlyChild(node, 'Issuer', assertion)) !== input.connection.issuer ||
    !hasValidBearerConfirmation(subject, input, now) ||
    !statements.some((statement) => isCurrentAuthentication(statement, now)) ||
    !allowsAudience(conditions, input.binding.serviceProviderEntityId) ||
    children(conditions).some(
      (condition) =>
        condition.namespaceURI !== assertion || !assertionConditions.has(condition.localName),
    )
  ) {
    refuse();
  }
  assertIssuedRecently(node, now);
  return textValue(nameId);
}

/** Checks the bounded POST envelope and the signed-data profile required by Identity. */
export function checkSamlPostEnvelope(input: SamlAssertionVerificationInput, now: number): string {
  const encoded = input.samlResponse;
  if (
    encoded.length === 0 ||
    encoded.length > 262_144 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)
  ) {
    refuse();
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.toString('base64') !== encoded) refuse();
  const response = parseRoot(utf8.decode(bytes), 'Response', protocol);
  const signedAssertion = onlyChild(response, 'Assertion', assertion);
  const status = onlyChild(onlyChild(response, 'Status', protocol), 'StatusCode', protocol);
  const [issuer, extraIssuer] = namedChildren(response, 'Issuer', assertion);
  if (
    response.getAttribute('Version') !== '2.0' ||
    response.getAttribute('Destination') !== input.binding.assertionConsumerUrl ||
    response.getAttribute('InResponseTo') !== input.requestId ||
    status.getAttribute('Value') !== 'urn:oasis:names:tc:SAML:2.0:status:Success' ||
    extraIssuer !== undefined ||
    (issuer !== undefined && textValue(issuer) !== input.connection.issuer)
  ) {
    refuse();
  }
  assertIssuedRecently(response, now);
  assertSignatureProfile(response);
  assertSignatureProfile(signedAssertion);
  return readAssertionSubject(signedAssertion, input, now);
}

/** Reads the opaque subject from the exact assertion returned after cryptographic verification. */
export function readVerifiedSamlSubject(
  xml: string,
  input: SamlAssertionVerificationInput,
  now: number,
): string {
  return readAssertionSubject(parseRoot(xml, 'Assertion', assertion), input, now);
}
