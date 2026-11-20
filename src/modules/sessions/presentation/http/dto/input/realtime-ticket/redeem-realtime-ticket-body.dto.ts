import { RedeemRealtimeTicketInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/** The opaque ticket from the realtime gateway, validated by the published contract. */
export class RedeemRealtimeTicketBody extends zodDto(RedeemRealtimeTicketInternalBody) {}
