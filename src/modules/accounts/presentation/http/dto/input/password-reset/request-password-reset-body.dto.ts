import { RequestPasswordResetInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class RequestPasswordResetBody
 *
 * @description
 * The body of `POST /internal/v1/auth/password-reset`, validated by the generated validator of
 * the contract: the address and the browser that asks.
 */
export class RequestPasswordResetBody extends zodDto(RequestPasswordResetInternalBody) {}
