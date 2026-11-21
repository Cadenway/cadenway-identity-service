/** Validates the canonical, registered callback URI, including HTTP loopback during local runs. */
export function parseSocialRedirectUri(value: string): URL {
  const url = URL.parse(value);
  const local =
    url?.hostname === 'localhost' ||
    url?.hostname.endsWith('.localhost') === true ||
    url?.hostname === '127.0.0.1' ||
    url?.hostname === '[::1]';
  if (
    url?.href !== value ||
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username !== '' ||
    url.password !== '' ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw new TypeError('Invalid configured social sign-in redirect URI.');
  }
  return url;
}
