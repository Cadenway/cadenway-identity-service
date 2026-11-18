import type { User } from '../../../domain/aggregates/account/user.aggregate.js';
import { toAccountView } from '../../mappers/accounts/account-view.mapper.js';
import { toClientDescription } from '../../mappers/sessions/client-description.mapper.js';
import { toNewDeviceNotice } from '../../mappers/sessions/new-device-notice.mapper.js';
import type { OpenedSession } from '../../models/sessions/opened-session.model.js';
import type { SessionClient } from '../../models/sessions/session-client.model.js';
import type { AccountsStore } from '../../models/transactions/accounts-store.model.js';
import type { DeviceReader } from '../../ports/outbound/device/accounts/device-reader.port.js';
import type { SessionOpener } from '../../ports/outbound/identity/sessions/session-opener.port.js';
import type { SessionIssuedView } from '../../projections/authentication/session-issued-view.projection.js';

/**
 * Function completeSignIn
 *
 * @description
 * What a successful sign-in, by password or by code, does once the credential is accepted, in the
 * transaction of the sign-in (`POST /internal/v1/auth/sign-in` and
 * `POST /internal/v1/auth/sign-in/code/verification`):
 *
 * - opens the session, which tells the person when the device was not used by the account in the
 *   last 90 days (`session.opened-on-new-device.v1`);
 * - cancels a scheduled deletion of the account ("une connexion suffit pour annuler"), with
 *   `user.deletion-cancelled.v1` and `deletionCancelled: true` in the answer.
 *
 * @param {AccountsStore} store - The repositories of the transaction.
 * @param {SessionOpener} sessions - Opens the session, joining the transaction.
 * @param {DeviceReader} devices - Reads the device of the browser.
 * @param {User} user - The verified account, locked by the caller.
 * @param {boolean} persistent - Whether "Rester connecté pendant 30 jours" was ticked.
 * @param {SessionClient} client - The browser that signs in.
 * @returns {Promise<SessionIssuedView>} The session, its token and the account.
 */
export async function completeSignIn(
  store: AccountsStore,
  sessions: SessionOpener,
  devices: DeviceReader,
  user: User,
  persistent: boolean,
  client: SessionClient,
): Promise<SessionIssuedView> {
  const session: OpenedSession = await sessions.open({
    userId: user.id,
    persistent,
    client,
    newDeviceNotice: toNewDeviceNotice(user),
  });
  const current: User = user.cancelDeletion();
  const deletionCancelled: boolean = current !== user;
  if (deletionCancelled) {
    await store.users.update(current);
    await store.events.userDeletionCancelled(
      current,
      session.id,
      toClientDescription(devices, client),
    );
  }
  return { session, user: toAccountView(current), deletionCancelled };
}
