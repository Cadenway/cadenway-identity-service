import { z } from 'zod';

const connection = z.strictObject({
  organizationId: z.uuid(),
  connectionId: z.string().min(1).max(128),
  verifiedDomains: z.array(z.string().min(1).max(253)).min(1).max(32),
  issuer: z.string().min(1).max(1024),
  entryPoint: z.url({ protocol: /^https$/u }),
  idpCertificate: z.string().min(1).max(16384),
  serviceProviderEntityId: z.string().min(1).max(1024),
  assertionConsumerUrl: z.url({ protocol: /^https?$/u }).refine((value) => {
    const url = URL.parse(value);
    return url !== null && value === `${url.origin}/v1/auth/sign-in/federated/saml/callback`;
  }, 'Expected the fixed Gateway SAML callback path.'),
});

const connections = z.array(connection).min(1).max(32);

/** Optional provisioned SAML connections and their independently verified domains. */
export interface SamlSignInConfig {
  // #region Properties
  /** Bindings managed by Identity before the browser can start SAML. */
  readonly SAML_SIGN_IN_CONNECTIONS?: z.output<typeof connections> | undefined;
  // #endregion
}

/** Parses provisioned connections while keeping input values out of configuration errors. */
export const samlSignInConfigShape = {
  SAML_SIGN_IN_CONNECTIONS: z
    .string()
    .max(524288)
    .transform((input, context) => {
      try {
        const parsed = connections.safeParse(JSON.parse(input));
        if (parsed.success) return parsed.data;
      } catch {
        // Report only the expected configuration shape.
      }
      context.addIssue({
        code: 'custom',
        message: 'Expected provisioned SAML connections as JSON.',
      });
      return z.NEVER;
    })
    .optional(),
};
