import { SignInWithCodeInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class SignInWithCodeBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in/code/verification`, validated with the schema of the
 * contract.
 */
export class SignInWithCodeBody extends zodDto(SignInWithCodeInternalBody) {}
