import { IssueRealtimeTicketInternalBody } from '@cadenway/contracts/validators/internal/identity-service';
import { zodDto } from '@cadenway/nest-common';

/** The issuing gateway's session identifier, validated by the published contract. */
export class IssueRealtimeTicketBody extends zodDto(IssueRealtimeTicketInternalBody) {}
