import { eventSchemas } from '@cadenway/contracts/events/organization-service';
import type {
  MemberJoinedV1,
  MemberRemovedV1,
  MemberRoleChangedV1,
} from '@cadenway/contracts/events/organization-service';
import type { EventConsumers, EventRedelivery } from '@cadenway/nest-messaging';
import type { OnApplicationBootstrap } from '@nestjs/common';

import type { ApplyMembershipChangeInput } from '../../../../application/use-cases/commands/membership/apply-membership-change/apply-membership-change.input.js';
import type { ApplyMembershipChange } from '../../../../application/use-cases/commands/membership/apply-membership-change/apply-membership-change.use-case.js';

/**
 * Function toChange
 *
 * @description
 * Maps a member event, validated against its AsyncAPI schema by the consumer of the kit, to the
 * input of the use case.
 *
 * @param {ApplyMembershipChangeInput['kind']} kind - Which event.
 * @param {MemberJoinedV1 | MemberRoleChangedV1 | MemberRemovedV1} payload - The payload.
 * @returns {ApplyMembershipChangeInput} The change to apply.
 */
function toChange(
  kind: ApplyMembershipChangeInput['kind'],
  payload: MemberJoinedV1 | MemberRoleChangedV1 | MemberRemovedV1,
): ApplyMembershipChangeInput {
  return {
    kind,
    memberId: payload.memberId,
    organizationId: payload.organizationId,
    userId: payload.userId,
    role: payload.role,
    version: payload.version,
    occurredAt: new Date(payload.occurredAt),
  };
}

/**
 * Class MemberEventsHandler
 *
 * @description
 * Subscribes the copy of the memberships to `member.joined.v1`, `member.role-changed.v1` and
 * `member.removed.v1` (`asyncapi/organization-service.yaml`), one durable consumer of `EVENTS` per
 * event (`identity-service__project-member-joined`, `…-role-changed`, `…-removed`), each filtered
 * on its subject. They start with `deliverPolicy: 'all'`, the default: a new consumer reads every
 * event the stream still holds, published before this service started included, and the handler has
 * no outside effect. The deduplicator of the kit runs each delivery in the tenant transaction of the
 * organization of its envelope and records its event id there, so a redelivery is skipped; the use
 * case orders the three subjects by the version of the membership, which `claimVersion` cannot do
 * since it keys versions per consumer. A failure is retried on the schedule `MembershipsModule`
 * gives the three consumers (about 25 hours in production, `memberEventsRedeliveryProvider`), then
 * kept as a dead letter: a removal must outlast an outage of the database rather than leave the
 * removed member's sessions and API tokens working. Built by `memberEventsHandlerProvider`.
 */
export class MemberEventsHandler implements OnApplicationBootstrap {
  // #region Properties
  /**
   * Property consumers
   *
   * @description
   * The durable consumers of the kit.
   *
   * @type {EventConsumers}
   * @readonly
   */
  private readonly consumers: EventConsumers;

  /**
   * Property applyMembershipChange
   *
   * @description
   * Use case of the copy.
   *
   * @type {ApplyMembershipChange}
   * @readonly
   */
  private readonly applyMembershipChange: ApplyMembershipChange;

  /**
   * Property redelivery
   *
   * @description
   * Redelivery schedule of the three consumers: the delays between the deliveries of a failing
   * event and the number of deliveries before its dead letter.
   *
   * @type {EventRedelivery}
   * @readonly
   */
  private readonly redelivery: EventRedelivery;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the consumers of the kit, the use case and the redelivery schedule, provided by
   * `MembershipsModule`.
   *
   * @param {EventConsumers} consumers - The durable consumers of the kit.
   * @param {ApplyMembershipChange} applyMembershipChange - Use case of the copy.
   * @param {EventRedelivery} redelivery - Redelivery schedule of the three consumers.
   * @constructor
   */
  public constructor(
    consumers: EventConsumers,
    applyMembershipChange: ApplyMembershipChange,
    redelivery: EventRedelivery,
  ) {
    this.consumers = consumers;
    this.applyMembershipChange = applyMembershipChange;
    this.redelivery = redelivery;
  }
  // #endregion

  // #region Methods
  /**
   * Method onApplicationBootstrap
   *
   * @description
   * Registers the three subscriptions once the application has bootstrapped, each with the
   * redelivery schedule. The kit checks the schedule before any broker request and sets its
   * delivery limit on the durable consumer, updating an existing one in place.
   *
   * @returns {Promise<void>} Resolves once the three consumers are bound.
   * @throws {Error} When the kit refuses the schedule or the broker refuses a consumer: the
   * start-up fails.
   */
  public async onApplicationBootstrap(): Promise<void> {
    await this.consumers.subscribe({
      handler: 'project-member-joined',
      schemas: eventSchemas,
      event: 'member.joined.v1',
      redelivery: this.redelivery,
      handle: (payload: MemberJoinedV1): Promise<void> =>
        this.applyMembershipChange.execute(toChange('joined', payload)),
    });
    await this.consumers.subscribe({
      handler: 'project-member-role-changed',
      schemas: eventSchemas,
      event: 'member.role-changed.v1',
      redelivery: this.redelivery,
      handle: (payload: MemberRoleChangedV1): Promise<void> =>
        this.applyMembershipChange.execute(toChange('role-changed', payload)),
    });
    await this.consumers.subscribe({
      handler: 'project-member-removed',
      schemas: eventSchemas,
      event: 'member.removed.v1',
      redelivery: this.redelivery,
      handle: (payload: MemberRemovedV1): Promise<void> =>
        this.applyMembershipChange.execute(toChange('removed', payload)),
    });
  }
  // #endregion
}
