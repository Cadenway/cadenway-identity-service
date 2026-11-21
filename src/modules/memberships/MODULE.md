# Memberships

## Purpose

The copy this service keeps of the memberships of cadenway-organization-service (decision 3 of the
P2b plan): which account belongs to which organization, with which role. organization-service owns
the organizations, the members and the invitations; this module only follows them from
`member.joined.v1`, `member.role-changed.v1` and `member.removed.v1`, so that:

- the sessions module checks the choice of an organization and fills the `organizationId` and the
  `role` of a session introspection;
- the api-tokens module refuses a token whose user no longer belongs to its organization and fills
  the `role` of its introspection;
- the accounts module refuses to schedule the deletion of an account that owns an organization
  (`409 account.organization-owner`), and checks again before the deletion
  ("Ownership" of `openapi/internal/identity-service.yaml`);
- the sessions module applies the authentication policy of each organization (P2c-2, decision 8):
  the roles of an account in every organization it belongs to (the requirements of two-step
  verification), the role of the actor of a policy route and the members an organization counts
  without two-step verification.

It owns no route and emits no event. A module of its own rather than a part of sessions: two
modules read it, and its tenant transactions (one per event) differ from the system transactions of
the sessions.

## Public entry points

| Entry point                                   | Consumers                      |
| --------------------------------------------- | ------------------------------ |
| `memberships.module`                          | sessions, api-tokens, accounts |
| `public/membership/find-active-membership`    | sessions, api-tokens           |
| `public/membership/lock-active-membership`    | accounts, sessions             |
| `public/membership/find-owned-organizations`  | accounts                       |
| `public/membership/find-user-memberships`     | sessions                       |
| `public/membership/find-organization-member`  | sessions                       |
| `public/membership/list-organization-members` | sessions                       |

`MembershipsModule` exports the `FindActiveMembership`, `LockActiveMembership`, `FindOwnedOrganizations`,
`FindUserMemberships`, `FindOrganizationMember` and `ListOrganizationMembers` providers, each with
its input and output types. `FindActiveMembership`, `FindOwnedOrganizations` and
`FindUserMemberships` and `LockActiveMembership` run in the system transaction of their caller and join it; they must not be
called from a tenant transaction (the kit refuses to open a system transaction inside a tenant one).
`FindOrganizationMember` and `ListOrganizationMembers` run in the tenant transaction of their
caller, the routes of the authentication policy, and join it.

## Owned tables

| Table         | Key                                | Organization scoping                                     |
| ------------- | ---------------------------------- | -------------------------------------------------------- |
| `memberships` | `id`, the `memberId` of the events | `organization_id`, policy of the kit, enabled and forced |

Created by `migrations/0003_organization_context_and_api_tokens.sql`, which forces its policy by
hand. `id` is the id organization-service gave the membership, not one PostgreSQL generates: a
projection keeps the id of its owner. `user_id` names an account of the accounts module without a
foreign key. Index `(organization_id, user_id)`, and `(user_id)` for the organizations an account
owns (migration 0004).

## API

None.

## Events emitted

None.

## Events consumed

| Event                    | Durable consumer                                | Effect                                     |
| ------------------------ | ----------------------------------------------- | ------------------------------------------ |
| `member.joined.v1`       | `identity-service__project-member-joined`       | Creates the membership, or nothing         |
| `member.role-changed.v1` | `identity-service__project-member-role-changed` | Changes its role when its version is newer |
| `member.removed.v1`      | `identity-service__project-member-removed`      | Marks it removed, for good                 |

- One durable pull consumer of `EVENTS` per event, filtered on its `evt.` subject, registered by
  `MemberEventsHandler` with the default `deliverPolicy: 'all'`: a new consumer reads every event
  the stream still holds, the events published before this service started included, as the
  contract requires of a copy. The handler has no outside effect, so reading again is harmless.
- Grants: the `identity` NATS user may create, read, pull from and acknowledge on these three
  consumers only, by their exact names and filters (cadenway-ops `compose/nats/nats-server.conf`,
  copied into `compose.dev.yaml`). A renamed handler, or one that consumes another event, is a new
  consumer: its grant reaches cadenway-ops and every environment before the release that adds it,
  which otherwise fails at start-up.
- Deduplication: the deduplicator of `OutboxModule` runs each delivery in the tenant transaction of
  the organization of its envelope and records `(consumer, event id)` in `processed_events` there;
  a redelivery is skipped. The copy and the processed id commit together.
- Order: the three events travel on three subjects and arrive in any order. The use case applies a
  membership by its `version` (`Membership.apply`): an older or equal version changes nothing, a
  removal always applies and stays applied, a late join or role change never brings it back.
  `claimVersion` of the kit cannot order them: it keys versions per consumer.
- Redelivery schedule (P2b security follow-ups, decision 3): a failure (the database unavailable, a
  membership id stored under another account or organization) is redelivered by the kit after 1 s,
  5 s, 30 s, 2 min, 10 min, 30 min, then every hour, for 32 deliveries: the 31 failed deliveries
  wait 92,556 s, about 25 h 43 min, before the dead letter, against 2 min 36 s for the default
  schedule of the kit. A dead-lettered `member.removed.v1` leaves the membership active in the copy:
  the removed member's sessions keep the organization and its API tokens keep working. The schedule
  therefore outlasts any outage of the database shorter than a day, and the margin over 24 hours
  covers deliveries lost to a crashed replica, which the broker redelivers after the 30 s
  acknowledgement wait and which count as deliveries. The three consumers share the schedule: a
  role change that lowers a role is a security projection as much as a removal, and a join given
  up would leave a member without access until an operator steps in.
  `memberEventsRedeliveryProvider` binds it to `MEMBER_EVENTS_REDELIVERY`; the kit sets
  `max_deliver` 32 on each durable consumer, updating an existing one in place, keeping its
  position and its pending messages, and refuses at start-up a schedule that would not end within
  half the seven-day retention of `EVENTS`.
- A long schedule has limits the kit does not check. A waiting message is among the oldest of
  `EVENTS`, which drops its oldest messages first past its byte cap (1 GiB in cadenway-ops): a
  removal dropped while it waits is lost without a dead letter and without an alert, and the
  removed member keeps access until the copy is rebuilt. That window grows from minutes to about a
  day with this schedule; cadenway-ops has no alert on it yet (an alert on the size of `EVENTS`
  near its cap, or on the age of its first message, would close it). Each waiting message also
  counts towards the 1000 unacknowledged messages of its consumer (`max_ack_pending`): past that,
  the consumer receives no new event until a waiting one is acknowledged or given up.
- A failure that cannot pass by itself (`MembershipMismatchError`) also waits the whole schedule
  before its dead letter, about a day instead of minutes: accepted, since telling it from an outage
  would need the handler to judge errors. The kit logs each failed delivery as a warning with its
  `errorClass` and consumer, which an alert can follow sooner than the dead letter.
- Rollout: a release that changes the schedule must replace every replica before it is relied on,
  with a deployment that recreates them all. A replica still on the previous
  limit treats its own fifth delivery as the last and asks for an immediate redelivery, which can
  use up the remaining deliveries in seconds, and such a replica that restarts sets `max_deliver`
  back to five. Removing the schedule, a rollback to a release without it included, brings the
  consumers back to five deliveries the same way, and a waiting message already past its fifth
  delivery becomes a dead letter at once: after such a rollback, read `EVENTS_DLQ` and requeue.
- After the last delivery the event becomes a dead letter in `EVENTS_DLQ`
  (`dlq.identity-service__project-member-<event>.evt.member.<event>.v1`), copied by the dead-letter
  worker of notification-service. An operator reads it, fixes the cause, and has
  organization-service requeue the event (`requeueOutboxEvents`) or rebuild the copy (below). Every
  dead letter of these consumers is an incident to alert on.

**Rebuild beyond the retention of the stream.** `EVENTS` keeps 7 days. The durable consumers keep
their position, so the copy falls behind only when this service consumes nothing for longer than
that, or when a new database starts after the first events left the stream. The copy is then
rebuilt by its owner re-emitting the current memberships with `RebuildEmitter` on
`rebuild.identity.membership` (the `identity` NATS user subscribes to `rebuild.identity.>` only),
received here with `EventConsumers.onRebuild` and applied with the same rules, which make an item
applied twice harmless. Neither exists yet: the item schema of a rebuilt membership belongs to
cadenway-api-contracts, the emitter to organization-service, the receiver to this module. Until
then, within 7 days of its outbox retention, organization-service publishes the rows again with
`requeueOutboxEvents`.

## Invariants

- A membership is active from its first `member.joined.v1` or `member.role-changed.v1` until its
  `member.removed.v1`; a removed membership stays removed, and the person who joins again gets a
  new `memberId`, hence a new row.
- The role is the role of the highest version applied.
- A membership never moves: an event that names another organization or account than the stored
  copy is refused. In the tenant transaction of the event, row-level security hides the rows of any
  other organization: the insert of an id stored under another one inserts nothing, the row stays
  invisible, and the event is refused the same way (`MembershipMismatchError`).
- A membership organization-service created a few seconds ago may not be here yet: callers answer
  as for a non-member (`organization.not-found`, an inactive token), as the contract states.

## Transactions

- `ApplyMembershipChange` runs in the tenant transaction the deduplicator of the kit opened for the
  organization of the event (`TenantMembershipsUnitOfWork` joins it). It locks the row; two events
  of a new membership handled at once both insert it with `on conflict do nothing`, the second then
  locks the stored row and applies itself.
- `FindActiveMembership` runs in the system transaction of its caller (`SystemMembershipsUnitOfWork`
  joins it): the choice of an organization, the opening and the introspection of a session, the
  introspection of an API token.
- `LockActiveMembership` joins the system transaction of the ticket operation and holds the current
  membership row until that transaction ends.
- `FindOwnedOrganizations` runs in the system transaction of its caller and joins it: the scheduling
  of the deletion of an account and its completion by its durable job.
- `FindUserMemberships` runs in the system transaction of its caller and joins it: the requirements
  of two-step verification of an account (its card, the refusal to turn it off).
- `FindOrganizationMember` and `ListOrganizationMembers` run in the tenant transaction of the
  policy routes (`TenantMembershipsUnitOfWork` joins it), so row-level security limits them to the
  organization of the internal token, which each query also names.

## Decisions

- The system runner serves `FindActiveMembership`, a bounded exception like the one of the
  accounts and sessions modules: its callers have no organization in their internal token (the
  choice of an organization, the introspections) or run inside the system transaction of a sign-in.
  The exception is bounded to reading this table, each read naming the organization and the
  account; every write goes through the tenant runner of the organization of its event.
- No outbox: the module emits nothing.
- `FindOwnedOrganizations` reads the copy by account across organizations, the one such read: the
  owner role of a membership that is not removed, which `member.joined.v1` gives the creator of an
  organization. It never calls organization-service. An organization created in the seconds before
  a scheduling may not be in the copy yet; the completion of the deletion checks again. When the
  account is deleted, the copy keeps its memberships (ids and role, no personal data) until the
  `member.removed.v1` organization-service emits for them reaches it.
- `FindUserMemberships` and `ListOrganizationMembers` return one active membership per organization
  or per account (the most recent when a person holds two), through the indexes on `user_id` and on
  `(organization_id, user_id)`. The listing reads every active member of the organization: it serves
  the counts of the policy screen only, and its cost grows with the members of the organization
  (P2c-2, see the sessions module).
- `tests/organization-context.int-spec.ts` proves, on real PostgreSQL and NATS, that member events
  published to the stream reach the copy, those published before the service started included,
  in any order of versions, with a removal after a role change kept, and a redelivered event
  applied once.
- The schedule is the value of a token, not a constant of the handler, so that
  `tests/membership-redelivery.int-spec.ts` replaces it with delays of a fraction of a second and
  proves on real PostgreSQL and NATS, under the exact-name grant, that durable consumers left at
  five deliveries are updated in place to the limit of the schedule with their position kept, that
  a removal three deliveries into the previous schedule is carried past its fifth delivery, that a
  removal whose first five deliveries fail is applied by the sixth, each redelivered after its
  delay, that an event is given up after its last delivery, and that the broker refuses a
  consumer it does not grant. `member-events-handler.provider.spec.ts` pins the
  production schedule the module subscribes the three consumers with.
