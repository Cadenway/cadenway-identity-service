import { SwitchSessionOrganizationParams } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class SwitchSessionOrganizationPath
 *
 * @description
 * Path of `PUT /internal/v1/sessions/{sessionId}/organization`: a UUID, else
 * `400 request.invalid`.
 */
export class SwitchSessionOrganizationPath extends zodDto(SwitchSessionOrganizationParams) {}
