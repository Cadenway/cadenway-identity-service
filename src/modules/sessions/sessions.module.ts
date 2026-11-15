import { SystemTransactionRunner } from '@cadenway/nest-common/database';
import { OutboxRelay, OutboxWriter } from '@cadenway/nest-messaging/outbox';
import { Module } from '@nestjs/common';

import { SystemClock } from '../../infrastructure/system-clock.js';
import { SessionsController } from './api/http/sessions.controller.js';
import { TokensController } from './api/http/tokens.controller.js';
import { IntrospectToken } from './application/commands/introspect-token.js';
import { OpenSession } from './application/commands/open-session.js';
import { RevokeSession } from './application/commands/revoke-session.js';
import type { Clock } from './application/ports/clock.port.js';
import type { DeviceReader } from './application/ports/device-reader.port.js';
import type { SessionTokens } from './application/ports/session-tokens.port.js';
import type { SessionsUnitOfWork } from './application/ports/sessions-unit-of-work.port.js';
import { BowserDeviceReader } from './infrastructure/device/bowser-device-reader.js';
import { SystemSessionsUnitOfWork } from './infrastructure/persistence/system-sessions-unit-of-work.js';
import { RandomSessionTokens } from './infrastructure/security/random-session-tokens.js';

/**
 * Constant UNIT_OF_WORK
 *
 * @description
 * Token of the `SessionsUnitOfWork` port.
 *
 * @type {unique symbol}
 */
const UNIT_OF_WORK: unique symbol = Symbol('SessionsUnitOfWork');

/**
 * Constant SESSION_TOKENS
 *
 * @description
 * Token of the `SessionTokens` port.
 *
 * @type {unique symbol}
 */
const SESSION_TOKENS: unique symbol = Symbol('SessionTokens');

/**
 * Constant DEVICE_READER
 *
 * @description
 * Token of the `DeviceReader` port.
 *
 * @type {unique symbol}
 */
const DEVICE_READER: unique symbol = Symbol('DeviceReader');

/**
 * Constant CLOCK
 *
 * @description
 * Token of the `Clock` port.
 *
 * @type {unique symbol}
 */
const CLOCK: unique symbol = Symbol('SessionsClock');

/**
 * Class SessionsModule
 *
 * @description
 * Composition root of the sessions module: sessions, their introspection and their revocation (see
 * its `MODULE.md`). It exports `OpenSession`, the entry point the accounts module calls once a
 * sign-in is verified.
 */
@Module({
  controllers: [TokensController, SessionsController],
  providers: [
    {
      provide: UNIT_OF_WORK,
      inject: [SystemTransactionRunner, OutboxWriter, OutboxRelay],
      useFactory: (
        runner: SystemTransactionRunner,
        outbox: OutboxWriter,
        relay: OutboxRelay,
      ): SessionsUnitOfWork => new SystemSessionsUnitOfWork(runner, outbox, relay),
    },
    { provide: SESSION_TOKENS, useFactory: (): SessionTokens => new RandomSessionTokens() },
    { provide: DEVICE_READER, useFactory: (): DeviceReader => new BowserDeviceReader() },
    { provide: CLOCK, useFactory: (): Clock => new SystemClock() },
    {
      provide: OpenSession,
      inject: [UNIT_OF_WORK, SESSION_TOKENS, DEVICE_READER, CLOCK],
      useFactory: (
        unitOfWork: SessionsUnitOfWork,
        tokens: SessionTokens,
        devices: DeviceReader,
        clock: Clock,
      ): OpenSession => new OpenSession(unitOfWork, tokens, devices, clock),
    },
    {
      provide: IntrospectToken,
      inject: [UNIT_OF_WORK, SESSION_TOKENS, CLOCK],
      useFactory: (
        unitOfWork: SessionsUnitOfWork,
        tokens: SessionTokens,
        clock: Clock,
      ): IntrospectToken => new IntrospectToken(unitOfWork, tokens, clock),
    },
    {
      provide: RevokeSession,
      inject: [UNIT_OF_WORK, CLOCK],
      useFactory: (unitOfWork: SessionsUnitOfWork, clock: Clock): RevokeSession =>
        new RevokeSession(unitOfWork, clock),
    },
  ],
  exports: [OpenSession],
})
export class SessionsModule {}
