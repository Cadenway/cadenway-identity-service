import { IntrospectApiTokenBody as IntrospectApiTokenSchema } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class IntrospectApiTokenBody
 *
 * @description
 * Body of `POST /internal/v1/api-tokens/introspect`, validated with the schema of the contract. The
 * token is a secret: the validator never echoes it, and nothing logs it.
 */
export class IntrospectApiTokenBody extends zodDto(IntrospectApiTokenSchema) {}
