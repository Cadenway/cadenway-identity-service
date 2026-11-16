import { SignUpInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class SignUpBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-up`, validated with the schema of the contract. The name is
 * also refused when it holds nothing but spaces, since its surrounding spaces are removed
 * (`SignUpRequest.name` of `openapi/public/auth.yaml`): `400 request.invalid` on `name`.
 */
export class SignUpBody extends zodDto(
  SignUpInternalBody.refine((body: { readonly name: string }): boolean => body.name.trim() !== '', {
    path: ['name'],
    error: 'Expected a name with a character other than a space',
  }),
) {}
