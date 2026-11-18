import { ReauthenticateInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class ReauthenticateBody
 *
 * @description
 * The body of `POST /internal/v1/sessions/{sessionId}/reauthentication`: the password of an account
 * without two-step verification, or a code of the authenticator app of an account with it, never
 * logged. Both or neither answer `400 request.invalid`, as the contract says it is checked here.
 */
export class ReauthenticateBody extends zodDto(
  ReauthenticateInternalBody.refine(
    (body: {
      readonly password?: string | undefined;
      readonly code?: string | undefined;
    }): boolean => (body.password === undefined) !== (body.code === undefined),
    { error: 'Expected exactly one of password and code' },
  ),
) {}
