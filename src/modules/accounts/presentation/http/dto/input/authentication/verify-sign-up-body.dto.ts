import { VerifySignUpInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class VerifySignUpBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-up/verification` (`SignUpVerification`), validated with the
 * schema of the contract, which keeps the optional `password` the gateway forwards; it is never
 * logged.
 */
export class VerifySignUpBody extends zodDto(VerifySignUpInternalBody) {}
