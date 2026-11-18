import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import type { NewDeviceNotice } from '../../models/sessions/new-device-notice.model.js';

/**
 * Function toNewDeviceNotice
 *
 * @description
 * Whom the "Nouvelle connexion" e-mail of a sign-in of an account addresses.
 *
 * @param {User} user - The account that signs in.
 * @returns {NewDeviceNotice} Its address, name, language and time zone.
 */
export function toNewDeviceNotice(user: User): NewDeviceNotice {
  return {
    email: user.email.value,
    name: user.name,
    language: user.language,
    timeZone: user.timeZone,
  };
}
