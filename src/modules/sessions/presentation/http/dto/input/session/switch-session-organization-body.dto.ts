import { SwitchSessionOrganizationBody as SwitchSessionOrganizationSchema } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/**
 * Class SwitchSessionOrganizationBody
 *
 * @description
 * Body of `PUT /internal/v1/sessions/{sessionId}/organization` (`OrganizationChoice`): the id of
 * the organization, a UUID, else `400 request.invalid`.
 */
export class SwitchSessionOrganizationBody extends zodDto(SwitchSessionOrganizationSchema) {}
