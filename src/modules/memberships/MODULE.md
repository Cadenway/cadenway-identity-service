# Memberships

## Purpose

The copy this service keeps of the memberships of cadenway-organization-service (decision 3 of the
P2b plan): which account belongs to which organization, with which role. organization-service owns
the organizations, the members and the invitations; this module only follows them from
`member.joined.v1`, `member.role-changed.v1` and `member.removed.v1`, so that:

- the sessions module checks the choice of an organization and fills the `organizationId` and the
  `role` of a session introspection;
- the api-tokens module refuses a token whose user no longer belongs to its organization and fills
  the `role` of its introspection.

It owns no route and emits no event. A module of its own rather than a part of sessions: two
modules read it, and its tenant transactions (one per event) differ from the system transactions of
the sessions.

## Public entry points

| Entry point                                | Consumers            |
| ------------------------------------------ | -------------------- |
| `memberships.module`                       | sessions, api-tokens |
| `public/membership/find-active-membership` | sessions, api-tokens |

`MembershipsModule` exports the `FindActiveMembership` provider. Its signature exposes
`FindActiveMembershipInput` and `FindActiveMembershipOutput`. It runs in the system transaction of
its caller and joins it; it must not be called from a tenant transaction (the kit refuses to open a
system transaction inside a tenant one).

## Owned tables

| Table         | Key                                | Organization scoping                                     |
| ------------- | ---------------------------------- | -------------------------------------------------------- |
| `memberships` | `id`, the `memberId` of the events | `organization_id`, policy of the kit, enabled and forced |

Created by `migrations/0003_organization_context_and_api_tokens.sql`, which forces its policy by
hand. `id` is the id organization-service gave the membership, not one PostgreSQL generates: a
projection keeps the id of its owner. `user_id` names an account of the accounts module without a
foreign key. Index `(organization_id, user_id)`.

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
- Deduplication: the deduplicator of `OutboxModule` runs each delivery in the tenant transaction of
  the organization of its envelope and records `(consumer, event id)` in `processed_events` there;
  a redelivery is skipped. The copy and the processed id commit together.
- Order: the three events travel on three subjects and arrive in any order. The use case applies a
  membership by its `version` (`Membership.apply`): an older or equal version changes nothing, a
  removal always applies and stays applied, a late join or role change never brings it back.
  `claimVersion` of the kit cannot order them: it keys versions per consumer.
- A failure (a membership id stored under another account or organization, the database
  unavailable) is retried by the kit after 1 s, 5 s, 30 s and 2 min, then becomes a dead letter in
  `EVENTS_DLQ` (`dlq.identity-service__project-member-<event>.evt.member.<event>.v1`). An operator
  reads the dead letter, fixes the cause, and has organization-service requeue the event
  (`requeueOutboxEvents`) or rebuild the copy (below). A dead-lettered `member.removed.v1` leaves
  the membership active in the copy until then: the sessions keep the organization and the API
  tokens keep working. Every dead letter of these consumers is therefore an incident to alert on;
  the kit has no per-subscription retry schedule that would avoid giving up on them.

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

## Decisions

- The system runner serves `FindActiveMembership`, a bounded exception like the one of the
  accounts and sessions modules: its callers have no organization in their internal token (the
  choice of an organization, the introspections) or run inside the system transaction of a sign-in.
  The exception is bounded to reading this table, each read naming the organization and the
  account; every write goes through the tenant runner of the organization of its event.
- No outbox: the module emits nothing.
- `tests/organization-context.int-spec.ts` proves, on real PostgreSQL and NATS, that member events
  published to the stream reach the copy, those published before the service started included,
  in any order of versions, with a removal after a role change kept, and a redelivered event
  applied once.
