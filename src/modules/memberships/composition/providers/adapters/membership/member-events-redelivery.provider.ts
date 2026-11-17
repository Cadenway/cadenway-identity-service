import type { EventRedelivery } from '@cadenway/nest-messaging';
import type { ValueProvider } from '@nestjs/common';

import { MEMBER_EVENTS_REDELIVERY } from '../../../tokens/membership/member-events-redelivery.token.js';

/**
 * Constant memberEventsRedeliveryProvider
 *
 * @description
 * The redelivery schedule of the three member event consumers (P2b security follow-ups, decision
 * 3): 1 s, 5 s, 30 s, 2 min, 10 min, 30 min, then every hour, 32 deliveries. The 31 failed
 * deliveries wait 92,556 s, about 25 h 43 min, before the dead letter, instead of the 2 min 36 s
 * of the default schedule of the kit: a `member.removed.v1` that a database outage makes fail must
 * not become a dead letter, leaving the removed member's sessions and API tokens working, before
 * the outage is over. The margin over 24 hours covers deliveries lost to a crashed replica, which
 * the server redelivers after the 30 s acknowledgement wait and which count as deliveries. The kit
 * checks at start-up that the schedule ends within half the seven-day retention of `EVENTS`.
 *
 * @type {ValueProvider<EventRedelivery>}
 */
export const memberEventsRedeliveryProvider: ValueProvider<EventRedelivery> = {
  provide: MEMBER_EVENTS_REDELIVERY,
  useValue: Object.freeze({
    delaysMs: Object.freeze([1_000, 5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000]),
    maxDeliveries: 32,
  }),
};
