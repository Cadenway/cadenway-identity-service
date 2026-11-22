import { SocialSignInProviderError } from '../../../domain/errors/federated-sign-in/social-sign-in-provider.error.js';

const maxResponseBytes = 256 * 1024;

/** Caps the decoded provider response size before the SDK or adapter parses JSON. */
export async function readSocialProviderBody(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new SocialSignInProviderError('unavailable');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
