import { IntrospectTokenBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class IntrospectionBody
 *
 * @description
 * Body of `POST /internal/v1/tokens/introspect`, validated with the schema of the contract. The
 * token is a secret: the validator never echoes it, and nothing logs it.
 */
export class IntrospectionBody extends zodDto(IntrospectTokenBody) {}
