import { z } from 'zod';

const keyVersion = z.string().regex(/^k[1-9]\d{0,8}$/u);
const keyMaterial = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/u)
  .refine((value) => Buffer.from(value, 'base64url').toString('base64url') === value);
const clientCredentials = z.strictObject({
  clientId: z
    .string()
    .max(512)
    .regex(/^[!-~]+$/u),
  clientSecret: z
    .string()
    .max(2048)
    .regex(/^[!-~]+$/u),
});

function isGatewayOrigin(value: string): boolean {
  const url = URL.parse(value);
  if (url?.origin !== value) return false;
  const loopback =
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';
  return url.protocol === 'https:' || (url.protocol === 'http:' && loopback);
}

const settings = z
  .strictObject({
    gatewayOrigin: z.string().max(512).refine(isGatewayOrigin),
    activeKeyVersion: keyVersion,
    stateKeys: z.record(keyVersion, keyMaterial),
    providers: z
      .strictObject({
        google: clientCredentials.optional(),
        github: clientCredentials.optional(),
        microsoft: clientCredentials
          .extend({
            tenantId: z.uuid(),
          })
          .optional(),
        gitlab: clientCredentials.optional(),
      })
      .refine((providers) => Object.keys(providers).length > 0),
  })
  .refine((value) => Object.hasOwn(value.stateKeys, value.activeKeyVersion));

/** Operator-supplied OAuth credentials held in memory, with a switch per configured provider. */
export interface SocialSignInConfig {
  // #region Properties
  /** Omit this value to disable all social sign-in providers. */
  readonly SOCIAL_SIGN_IN_CONFIG?: z.infer<typeof settings> | undefined;
  // #endregion
}

/** Reads the optional JSON configuration without exposing its keys or credentials on failure. */
export const socialSignInConfigShape = {
  SOCIAL_SIGN_IN_CONFIG: z
    .string()
    .max(32_768)
    .optional()
    .transform((value, context): SocialSignInConfig['SOCIAL_SIGN_IN_CONFIG'] => {
      if (value === undefined || value.trim() === '') return undefined;
      try {
        const decoded: unknown = JSON.parse(value);
        const parsed = settings.safeParse(decoded);
        if (parsed.success) return parsed.data;
      } catch {
        // A parse error can contain part of the environment value.
      }
      context.addIssue({
        code: 'custom',
        message: 'Expected a valid social sign-in configuration.',
      });
      return z.NEVER;
    }),
} as const;
