import { ConfirmAuthenticatorAppSetupInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ConfirmAuthenticatorAppSetupBody
 *
 * @description
 * The body of `POST .../authenticator-app/setup/confirmation`: the session, the code of the new app, never logged, and the browser.
 */
export class ConfirmAuthenticatorAppSetupBody extends zodDto(
  ConfirmAuthenticatorAppSetupInternalBody,
) {}
