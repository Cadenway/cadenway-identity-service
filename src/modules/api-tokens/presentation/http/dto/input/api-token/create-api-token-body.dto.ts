import { CreateApiTokenInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class CreateApiTokenBody
 *
 * @description
 * Body of `POST /internal/v1/api-tokens` (`ApiTokenCreation`), validated with the schema of the
 * contract; `expiration` defaults to `30-days`. The name is also refused when it holds nothing but
 * spaces, since its surrounding spaces are removed: `400 request.invalid` on `name`.
 */
export class CreateApiTokenBody extends zodDto(
  CreateApiTokenInternalBody.refine(
    (body: { readonly name: string }): boolean => body.name.trim() !== '',
    { path: ['name'], error: 'Expected a name with a character other than a space' },
  ),
) {}
