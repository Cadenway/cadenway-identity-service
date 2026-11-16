import { SignInWithPasswordInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class PasswordSignInBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in`, validated with the schema of the contract.
 */
export class PasswordSignInBody extends zodDto(SignInWithPasswordInternalBody) {}
