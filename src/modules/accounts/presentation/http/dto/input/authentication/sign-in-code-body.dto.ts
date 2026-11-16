import { RequestSignInCodeInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class SignInCodeBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in/code`, validated with the schema of the contract.
 */
export class SignInCodeBody extends zodDto(RequestSignInCodeInternalBody) {}
