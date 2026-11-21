import { CompleteOAuthSignInInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';
import { z } from 'zod';

/** Preserves the contract's closed nested callback variants. */
const strictOAuthBody = CompleteOAuthSignInInternalBody.extend({
  response: z.union(
    CompleteOAuthSignInInternalBody.shape.response.options.map((option) => option.strict()),
  ),
});

/** Validates the OAuth callback without dropping fields from either nested variant. */
export class FederatedOauthCallbackDto extends zodDto(strictOAuthBody) {}
