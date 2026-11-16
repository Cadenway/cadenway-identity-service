import { ResendSignUpCodeInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ResendSignUpCodeBody
 *
 * @description
 * Body of `POST /internal/v1/auth/sign-up/code`, validated with the schema of the contract.
 */
export class ResendSignUpCodeBody extends zodDto(ResendSignUpCodeInternalBody) {}
