import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { eventSchemas } from '@cadenway/contracts/events/organization-service';
import { ConfigModule, loadConfig } from '@cadenway/nest-common';
import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { EventConsumers } from '@cadenway/nest-messaging';
import type { EventRedelivery } from '@cadenway/nest-messaging';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { appConfigSchema } from '../src/config/app-config.js';
import type { ApplyMembershipChangeInput } from '../src/modules/memberships/application/use-cases/commands/membership/apply-membership-change/apply-membership-change.input.js';
import { ApplyMembershipChange } from '../src/modules/memberships/application/use-cases/commands/membership/apply-membership-change/apply-membership-change.use-case.js';
import { MEMBER_EVENTS_REDELIVERY } from '../src/modules/memberships/composition/tokens/membership/member-events-redelivery.token.js';

// The redelivery schedule of the three member event consumers (decision 3 of the P2b security
// follow-ups) on real PostgreSQL and NATS, started from compose.dev.yaml as in
// service-wiring.int-spec.ts, whose broker grants the `identity` user its three consumers by name
// only. The application is AppModule with one provider replaced: `MEMBER_EVENTS_REDELIVERY` gets
// delays of a fraction of a second instead of the 25 hours of production, which
// member-events-handler.provider.spec.ts pins. A failing handler is a use case that rejects while
// the test says so, as it would while its database is unavailable; the kit, the durable consumers
// and the broker are real. Member events are published with the `admin` user of the `nats-streams`
// container, as organization-service would publish them.

/** Compose file of the development dependencies. */
const composeFile: string = fileURLToPath(new URL('../compose.dev.yaml', import.meta.url));

/** Throwaway project name, distinct from the other specs and from any developer stack. */
const project = `cadenway-identity-service-redelivery-test-${String(process.pid)}`;

/**
 * The schedule of the test: 250 ms, 500 ms, then 1 s, eight deliveries. Three more deliveries than
 * the five of the default schedule of the kit, so that an event outliving five failures shows the
 * schedule of the registration is the one applied.
 */
const testSchedule: EventRedelivery = { delaysMs: [250, 500, 1_000], maxDeliveries: 8 };

/** How late a redelivery may come after its delay: pulls, transactions and Docker on CI. */
const latenessMs = 1_500;

/** Atelier Nord, the organization of the mockup. */
const atelierNord = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

/** The accounts of the specs, people of the mockup. */
const people = {
  camille: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  hugo: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b32',
} as const;

/** Their memberships in Atelier Nord, as organization-service ids them. */
const members = {
  camille: '019a6b10-0000-7000-8000-0000000000a1',
  hugo: '019a6b10-0000-7000-8000-0000000000a2',
} as const;

/** What the durable consumer reports to the `admin` user (`nats consumer info --json`). */
interface ConsumerInfo {
  readonly config: { readonly max_deliver: number };
  readonly num_ack_pending: number;
  readonly num_pending: number;
}

/**
 * The deliveries of one event that reach the use case: the instant of each, in milliseconds of
 * `performance.now()`, and how many more must fail.
 */
interface FailurePlan {
  readonly attempts: number[];
  remaining: number;
}

/** The failure plans, by `<kind>:<memberId>`; an event without a plan is applied as usual. */
const plans = new Map<string, FailurePlan>();

/**
 * Runs `docker compose` on the throwaway project.
 *
 * @param args - Compose command and its arguments.
 * @returns The standard output.
 */
function compose(...args: readonly string[]): string {
  return execFileSync(
    'docker',
    ['compose', '--project-name', project, '--file', composeFile, ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, DEV_POSTGRES_PORT: '0', DEV_NATS_PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

/**
 * Reads the published host port of a service of the project.
 *
 * @param service - Compose service.
 * @param port - Port inside the container.
 * @returns The host port.
 */
function hostPort(service: string, port: string): string {
  return compose('port', service, port).trim().split(':').at(-1) ?? '';
}

/**
 * Publishes a member event on its `evt.` subject with the `admin` user, as the outbox relay of
 * organization-service does, and waits for the acknowledgement of the stream.
 *
 * @param kind - Which event.
 * @param memberId - The membership.
 * @param userId - Its account.
 * @param role - The role after the event.
 * @param version - The version of the membership after the event.
 */
function publishMemberEvent(
  kind: ApplyMembershipChangeInput['kind'],
  memberId: string,
  userId: string,
  role: ApplyMembershipChangeInput['role'],
  version: number,
): void {
  const id = randomUUID();
  const payload: Record<string, unknown> = {
    id,
    occurredAt: new Date().toISOString(),
    organizationId: atelierNord,
    actor: { type: 'user', id: people.camille },
    version,
    memberId,
    userId,
    role,
    ...(kind === 'joined' ? { invitationId: null } : {}),
    ...(kind === 'role-changed' ? { previousRole: 'member' } : {}),
  };
  compose(
    'exec',
    '-T',
    'nats-streams',
    'nats',
    'pub',
    '--jetstream',
    '--header',
    `Nats-Msg-Id:${id}`,
    `evt.member.${kind}.v1`,
    JSON.stringify(payload),
  );
}

/**
 * Reads a durable consumer of `EVENTS` as the `admin` user.
 *
 * @param handler - The handler of the consumer, after `identity-service__`.
 * @returns What the broker reports.
 */
function consumerInfo(handler: string): ConsumerInfo {
  return JSON.parse(
    compose(
      'exec',
      '-T',
      'nats-streams',
      'nats',
      'consumer',
      'info',
      'EVENTS',
      `identity-service__${handler}`,
      '--json',
    ),
  ) as ConsumerInfo;
}

/**
 * The time between successive deliveries.
 *
 * @param attempts - The instants of the deliveries.
 * @returns The gaps, in milliseconds.
 */
function gaps(attempts: readonly number[]): number[] {
  return attempts.slice(1).map((instant, index) => instant - (attempts[index] ?? instant));
}

/**
 * The delay the schedule of the test gives each failed delivery but the last, the last delay
 * repeating.
 *
 * @param failures - The number of failed deliveries followed by another one.
 * @returns The delays, in milliseconds.
 */
function scheduledDelays(failures: number): number[] {
  const { delaysMs } = testSchedule;
  return Array.from(
    { length: failures },
    (_, index) => delaysMs[Math.min(index, delaysMs.length - 1)] ?? 0,
  );
}

/**
 * Creates an Ed25519 public key in the JWK form the configuration of the internal token requires.
 *
 * @returns The public key of a trusted issuer that never signs in this spec.
 */
function trustedIssuerKey(): Record<string, string> {
  const { x } = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' });
  if (x === undefined) {
    throw new Error('Node returned an Ed25519 JWK without its key material.');
  }
  return { kty: 'OKP', crv: 'Ed25519', x, kid: 'test-api-gateway' };
}

/**
 * Applies the migrations with `src/migrate.ts`, as the migration container does.
 */
async function runMigrator(): Promise<void> {
  vi.resetModules();
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    await import('../src/migrate.js');
  } finally {
    log.mockRestore();
  }
}

describe('identity-service redelivery of the member events', () => {
  let moduleRef: TestingModule;

  /**
   * Reads the copy of a membership in a system transaction of the application role.
   *
   * @param memberId - The membership.
   * @returns Its row, or `undefined` before its first event arrived.
   */
  async function membership(
    memberId: string,
  ): Promise<{ role: string; version: number; removed: boolean } | undefined> {
    const rows = await moduleRef.get(SystemTransactionRunner, { strict: false }).run(
      async (tx) =>
        (
          await tx.client.query(
            `select role, version, removed_at is not null as removed
                 from memberships where id = $1`,
            [memberId],
          )
        ).rows as { role: string; version: number; removed: boolean }[],
    );
    return rows[0];
  }

  /**
   * Waits until the copy of a membership matches.
   *
   * @param memberId - The membership.
   * @param expected - The members it must have.
   */
  async function untilMembership(memberId: string, expected: object): Promise<void> {
    await vi.waitFor(
      async () => {
        expect(await membership(memberId)).toMatchObject(expected);
      },
      { timeout: 20_000, interval: 100 },
    );
  }

  /**
   * Makes the deliveries of one event fail.
   *
   * @param kind - Which event.
   * @param memberId - The membership it names.
   * @param failures - How many deliveries fail before one is applied.
   * @returns The plan, which records each delivery.
   */
  function failNext(
    kind: ApplyMembershipChangeInput['kind'],
    memberId: string,
    failures: number,
  ): FailurePlan {
    const plan: FailurePlan = { attempts: [], remaining: failures };
    plans.set(`${kind}:${memberId}`, plan);
    return plan;
  }

  beforeAll(async () => {
    compose(
      'up',
      '--detach',
      '--wait',
      '--wait-timeout',
      '120',
      'postgres',
      'nats',
      'nats-streams',
    );
    const postgresPort = hostPort('postgres', '5432');
    const natsPort = hostPort('nats', '4222');

    vi.stubEnv(
      'MIGRATION_DATABASE_URL',
      `postgres://identity_migrator:identity_migrator@127.0.0.1:${postgresPort}/identity`,
    );
    await runMigrator();

    vi.stubEnv('PORT', '3010');
    vi.stubEnv('LOG_PRETTY', 'false');
    vi.stubEnv(
      'DATABASE_URL',
      `postgres://identity_app:identity_app@127.0.0.1:${postgresPort}/identity`,
    );
    vi.stubEnv('NATS_URL', `nats://127.0.0.1:${natsPort}`);
    vi.stubEnv('NATS_USER', 'identity');
    vi.stubEnv('NATS_PASSWORD', 'identity');
    vi.stubEnv('INTERNAL_TOKEN_AUDIENCE', 'identity-service');
    vi.stubEnv(
      'INTERNAL_TOKEN_TRUSTED_ISSUERS',
      JSON.stringify({ 'api-gateway': [trustedIssuerKey()] }),
    );
    vi.stubEnv('PASSWORD_PEPPER', 'integration-test-password-pepper-redelivery-000');

    // AppModule as main.ts assembles it, without the HTTP formats of `createApplication`, which no
    // delivery goes through, and with the schedule of the test.
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forValue(loadConfig(appConfigSchema)), AppModule],
    })
      .overrideProvider(MEMBER_EVENTS_REDELIVERY)
      .useValue(testSchedule)
      .setLogger({ log: () => undefined, error: () => undefined, warn: () => undefined })
      .compile();

    // The handler holds this instance: a delivery with a failure plan records its instant and
    // rejects while the plan says so, as the use case does while its database is unavailable.
    const useCase = moduleRef.get(ApplyMembershipChange, { strict: false });
    const apply = useCase.execute.bind(useCase);
    vi.spyOn(useCase, 'execute').mockImplementation(
      async (input: ApplyMembershipChangeInput): Promise<void> => {
        const plan = plans.get(`${input.kind}:${input.memberId}`);
        if (plan !== undefined) {
          plan.attempts.push(performance.now());
          if (plan.remaining > 0) {
            plan.remaining -= 1;
            throw new Error('The database is unavailable.');
          }
        }
        await apply(input);
      },
    );

    await moduleRef.init();

    publishMemberEvent('joined', members.camille, people.camille, 'owner', 1);
    publishMemberEvent('joined', members.hugo, people.hugo, 'member', 1);
    await untilMembership(members.camille, { role: 'owner', version: 1, removed: false });
    await untilMembership(members.hugo, { role: 'member', version: 1, removed: false });
  });

  afterAll(async () => {
    try {
      await moduleRef.close();
    } finally {
      vi.unstubAllEnvs();
      compose('down', '--volumes', '--remove-orphans');
    }
  });

  it('gives each durable consumer the delivery limit of its schedule', () => {
    for (const handler of [
      'project-member-joined',
      'project-member-role-changed',
      'project-member-removed',
    ]) {
      expect(consumerInfo(handler).config.max_deliver).toBe(testSchedule.maxDeliveries);
    }
  });

  it('applies a removal whose first five deliveries fail, each redelivered after its delay', async () => {
    const plan = failNext('removed', members.camille, 5);

    publishMemberEvent('removed', members.camille, people.camille, 'owner', 2);

    await untilMembership(members.camille, { removed: true, version: 2 });
    // Five failures, then the sixth delivery applies it: the default schedule of the kit would
    // have made it a dead letter after the fifth.
    expect(plan.attempts).toHaveLength(6);
    const expected = scheduledDelays(5);
    gaps(plan.attempts).forEach((gap, index) => {
      const delay = expected[index] ?? 0;
      expect(gap).toBeGreaterThanOrEqual(delay - 10);
      expect(gap).toBeLessThan(delay + latenessMs);
    });
    expect(consumerInfo('project-member-removed')).toMatchObject({
      num_ack_pending: 0,
      num_pending: 0,
    });
  });

  it('gives an event up after the last delivery of its schedule, and never delivers it again', async () => {
    const plan = failNext('role-changed', members.hugo, Number.POSITIVE_INFINITY);
    const deliveries = testSchedule.maxDeliveries ?? 0;

    publishMemberEvent('role-changed', members.hugo, people.hugo, 'admin', 2);

    await vi.waitFor(
      () => {
        expect(plan.attempts).toHaveLength(deliveries);
      },
      { timeout: 20_000, interval: 50 },
    );
    const expected = scheduledDelays(deliveries - 1);
    gaps(plan.attempts).forEach((gap, index) => {
      const delay = expected[index] ?? 0;
      expect(gap).toBeGreaterThanOrEqual(delay - 10);
      expect(gap).toBeLessThan(delay + latenessMs);
    });
    // Longer than the last delay and its lateness: a ninth delivery would have come by now.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(plan.attempts).toHaveLength(deliveries);
    expect(await membership(members.hugo)).toMatchObject({ role: 'member', version: 1 });
    expect(consumerInfo('project-member-role-changed')).toMatchObject({
      num_ack_pending: 0,
      num_pending: 0,
    });
  });

  it('cannot open a consumer the broker does not grant, as a new handler without its grant', async () => {
    await expect(
      moduleRef.get(EventConsumers, { strict: false }).subscribe({
        handler: 'project-member-audit',
        schemas: eventSchemas,
        event: 'member.joined.v1',
        handle: async (): Promise<void> => {
          // Never reached: the broker refuses the consumer.
        },
      }),
    ).rejects.toThrow(/permission/iu);
  });
});
