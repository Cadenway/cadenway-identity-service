import { AddSecurityKeyInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class AddSecurityKeyBody
 *
 * @description
 * The body of `POST .../two-step-verification/security-keys`: the session, the name of the key, the
 * `RegistrationResponseJSON` of the browser and the browser. A name made only of spaces answers
 * `400 request.invalid`, as the contract says it is trimmed here.
 */
export class AddSecurityKeyBody extends zodDto(
  AddSecurityKeyInternalBody.refine(
    (body: { readonly name: string }): boolean => body.name.trim() !== '',
    { path: ['name'], error: 'Expected a name with a character other than a space' },
  ),
) {}
