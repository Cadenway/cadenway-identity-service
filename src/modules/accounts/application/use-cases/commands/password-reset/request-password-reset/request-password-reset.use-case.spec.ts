import { beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../../../domain/aggregates/account/user.aggregate.js';
import type { PasswordResetLinkState } from '../../../../../domain/aggregates/password-reset/password-reset-link-state.aggregate.js';
import {
  FakeDeviceReader,
  FakeResetLinkSecrets,
  FixedClock,
  InMemoryAccounts,
} from '../../../../models/accounts/accounts.fixture.js';
import type { RecordedEvent } from '../../../../models/accounts/accounts.fixture.js';
import type { CodeSentView } from '../../../../projections/authentication/code-sent-view.projection.js';
import type { RequestPasswordResetInput } from './request-password-reset.input.js';
import { RequestPasswordReset } from './request-password-reset.use-case.js';

/**
 * Constant CLIENT
 *
 * @description
 * The browser that asks for the link.
 *
 * @type {RequestPasswordResetInput['client']}
 */
const CLIENT: RequestPasswordResetInput['client'] = {
  ipAddress: '192.0.2.14',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

describe('RequestPasswordReset', () => {
  let accounts: InMemoryAccounts;
  let clock: FixedClock;
  let secrets: FakeResetLinkSecrets;
  let request: RequestPasswordReset;
  let camille: User;

  beforeEach(() => {
    accounts = new InMemoryAccounts();
    clock = new FixedClock('2026-11-09T13:10:00Z');
    secrets = new FakeResetLinkSecrets();
    request = new RequestPasswordReset(accounts, secrets, new FakeDeviceReader(), clock);
    camille = accounts.seedUser('camille.martin@ateliernord.fr', true, 'hashed:x');
  });

  /**
   * The reset links events appended so far.
   *
   * @returns The events.
   */
  function linkEvents(): RecordedEvent[] {
    return accounts.state.events.filter(
      (event: RecordedEvent) => event.name === 'password-reset-link.issued.v1',
    );
  }

  it('issues a link of 30 minutes to a verified account, in the restricted event only', async () => {
    const sent: CodeSentView = await request.execute({
      email: ' Camille.Martin@AtelierNord.fr ',
      client: CLIENT,
    });

    expect(sent).toEqual({
      email: 'camille.martin@ateliernord.fr',
      expiresAt: new Date('2026-11-09T13:40:00Z'),
      resendAvailableAt: new Date('2026-11-09T13:10:45Z'),
    });
    const link: PasswordResetLinkState | undefined = accounts.state.resetLinks.at(-1);
    expect(link).toMatchObject({
      userId: camille.id,
      tokenHash: 'hash:reset-token-1',
      expiresAt: new Date('2026-11-09T13:40:00Z'),
    });
    expect(JSON.stringify(link)).not.toContain('"reset-token-1"');
    expect(linkEvents()).toEqual([
      {
        name: 'password-reset-link.issued.v1',
        issued: {
          linkId: link?.id,
          user: camille,
          token: 'reset-token-1',
          expiresAt: new Date('2026-11-09T13:40:00Z'),
          client: {
            device: {
              type: 'desktop',
              browser: 'Firefox',
              browserVersion: '132',
              os: 'Windows',
              osVersion: null,
            },
            ipAddress: '192.0.2.14',
          },
        },
      },
    ]);
  });

  it('answers the same way for an address without an account, or an unverified one, and issues nothing', async () => {
    accounts.seedUser('pending@ateliernord.fr', false, 'hashed:x');
    for (const email of ['nobody@ateliernord.fr', 'pending@ateliernord.fr']) {
      await expect(request.execute({ email, client: CLIENT })).resolves.toEqual({
        email,
        expiresAt: new Date('2026-11-09T13:40:00Z'),
        resendAvailableAt: new Date('2026-11-09T13:10:45Z'),
      });
    }

    expect(accounts.state.resetLinks).toEqual([]);
    expect(linkEvents()).toEqual([]);
    expect(secrets.issued).toBe(2);
  });

  it('makes the previous link of the account stop working', async () => {
    await request.execute({ email: camille.email.value, client: CLIENT });
    clock.advance(45_000);
    await request.execute({ email: camille.email.value, client: CLIENT });

    expect(accounts.state.resetLinks).toEqual([
      expect.objectContaining({
        tokenHash: 'hash:reset-token-1',
        replacedAt: new Date('2026-11-09T13:10:45Z'),
      }),
      expect.objectContaining({ tokenHash: 'hash:reset-token-2', replacedAt: null }),
    ]);
  });

  it('throttles the address 45 seconds, account or not', async () => {
    await request.execute({ email: 'nobody@ateliernord.fr', client: CLIENT });
    clock.advance(44_000);

    await expect(
      request.execute({ email: 'nobody@ateliernord.fr', client: CLIENT }),
    ).rejects.toMatchObject({
      refusal: { reason: 'reset-throttled', resendAvailableAt: new Date('2026-11-09T13:10:45Z') },
    });
    clock.advance(1_000);
    await expect(
      request.execute({ email: 'nobody@ateliernord.fr', client: CLIENT }),
    ).resolves.toBeDefined();
  });

  it('accepts 5 requests of an address in an hour, then refuses until the hour ends', async () => {
    for (let attempt: number = 0; attempt < 5; attempt += 1) {
      await request.execute({ email: camille.email.value, client: CLIENT });
      clock.advance(45_000);
    }

    await expect(
      request.execute({ email: camille.email.value, client: CLIENT }),
    ).rejects.toMatchObject({
      refusal: { reason: 'reset-throttled', resendAvailableAt: new Date('2026-11-09T14:10:00Z') },
    });
    expect(linkEvents()).toHaveLength(5);
  });

  it('counts the requests apart from the code requests of the address', async () => {
    await request.execute({ email: camille.email.value, client: CLIENT });

    expect(accounts.state.codeRequests.size).toBe(0);
    expect(accounts.state.resetRequests.get(camille.email.value)?.snapshot.windowRequests).toBe(1);
  });
});
