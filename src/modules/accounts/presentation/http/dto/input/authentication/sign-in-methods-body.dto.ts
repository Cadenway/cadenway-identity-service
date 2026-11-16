import { DiscoverSignInMethodsInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class SignInMethodsBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-in-methods`, validated with the schema of the contract.
 */
export class SignInMethodsBody extends zodDto(DiscoverSignInMethodsInternalBody) {}
