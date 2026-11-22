import { FederatedSignInRefusedError } from '../../errors/federated-sign-in/federated-sign-in-refused.error.js';
import type { FederatedConnection } from '../../value-objects/federated-sign-in/federated-connection.value-object.js';
import type { FederatedFinishAuthority } from '../../value-objects/federated-sign-in/federated-finish-authority.value-object.js';
import type { FederatedIdentity } from '../../value-objects/federated-sign-in/federated-identity.value-object.js';
import type { FederatedSignInDecision } from '../../value-objects/federated-sign-in/federated-sign-in-decision.value-object.js';
import type { LinkedFederatedAccount } from '../../value-objects/federated-sign-in/linked-federated-account.value-object.js';
import type { VerifiedFederatedIdentity } from '../../value-objects/federated-sign-in/verified-federated-identity.value-object.js';

const flowLifetimeMs = 10 * 60_000;
const receiptLifetimeMs = 2 * 60_000;
const sha256Hex = /^[\da-f]{64}$/u;
const supportedProviders: readonly FederatedConnection['provider'][] = [
  'google',
  'github',
  'microsoft',
  'gitlab',
  'saml',
];
const twoStepDecisions: readonly FederatedFinishAuthority['twoStep'][] = [
  'not-required',
  'trusted-device',
  'challenge-required',
];

/** Inputs created by Identity before redirecting. The raw state and browser secret stay at the boundary. */
interface FederatedFlowIssue {
  // #region Properties
  /** Stable flow identifier supplied by the persistence boundary. */
  readonly id: string;
  readonly connection: FederatedConnection;
  readonly stateHash: string;
  readonly browserBindingHash: string;
  readonly persistent: boolean;
  // #endregion
}

/** The original callback credentials, hashed at the boundary. */
interface FederatedCallbackBinding {
  // #region Properties
  /** Provider selected by the callback route. */
  readonly provider: FederatedConnection['provider'];
  readonly stateHash: string;
  readonly browserBindingHash: string;
  // #endregion
}

interface Continuation {
  // #region Properties
  /** Verified identity against which the current account link is checked. */
  readonly identity: FederatedIdentity;
  readonly linkId: string;
  readonly userId: string;

  /** Membership proved at the SAML callback. Legacy receipts carry no usable membership proof. */
  readonly memberId?: string;

  readonly receiptHash: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly redeemedAtMs: number | null;
  // #endregion
}

type FlowPhase =
  | { readonly kind: 'open' }
  | { readonly kind: 'claimed'; readonly claimedAtMs: number }
  | {
      readonly kind: 'complete';
      readonly claimedAtMs: number;
      readonly continuation: Continuation;
    };

/** Restorable state for atomic transitions; timestamps are milliseconds since the Unix epoch. */
export interface FederatedSignInFlowState extends FederatedFlowIssue {
  // #region Properties
  /** Instant when Identity issued the browser-bound flow. */
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly phase: FlowPhase;
  // #endregion
}

/** The consumed state to save and the decision to apply within the same transaction. */
interface FederatedSignInRedemption {
  // #region Properties
  /** The state to persist even when the current authority refuses sign-in. */
  readonly flow: FederatedSignInFlow;
  readonly decision: FederatedSignInDecision;
  // #endregion
}

function timeWithin(value: number, start: number, end: number): boolean {
  return Number.isSafeInteger(value) && value >= start && value < end;
}

function validLifetime(start: number, end: number, limit: number): boolean {
  return (
    Number.isSafeInteger(start) && Number.isSafeInteger(end) && end > start && end - start <= limit
  );
}

function isSameConnection(expected: FederatedConnection, proved: FederatedConnection): boolean {
  return (
    expected.provider === proved.provider &&
    expected.issuer === proved.issuer &&
    (expected.provider !== 'saml' ||
      (proved.provider === 'saml' &&
        expected.organizationId === proved.organizationId &&
        expected.connectionId === proved.connectionId))
  );
}

function isExistingLink(
  link: LinkedFederatedAccount | null,
  identity: FederatedIdentity,
): link is LinkedFederatedAccount {
  return (
    link !== null &&
    link.status === 'active' &&
    link.id.trim().length > 0 &&
    link.userId.trim().length > 0 &&
    isSameConnection(identity, link.identity) &&
    link.identity.subject === identity.subject
  );
}

function identityOf(connection: FederatedConnection, subject: string): FederatedIdentity {
  const { provider, issuer } = connection;
  return provider === 'saml'
    ? {
        provider,
        issuer,
        organizationId: connection.organizationId,
        connectionId: connection.connectionId,
        subject,
      }
    : { provider, issuer, subject };
}

// Copy allowed fields so a caller cannot inadvertently persist additional provider credentials.
function persistedPhase(phase: FlowPhase): FlowPhase {
  if (phase.kind === 'open') return { kind: 'open' };
  const claimedAtMs = phase.claimedAtMs;
  if (phase.kind === 'claimed') return { kind: 'claimed', claimedAtMs };
  const { identity, linkId, userId, memberId, receiptHash, issuedAtMs, expiresAtMs, redeemedAtMs } =
    phase.continuation;
  return {
    kind: 'complete',
    claimedAtMs,
    continuation: {
      identity: identityOf(identity, identity.subject),
      linkId,
      userId,
      ...(memberId === undefined ? {} : { memberId }),
      receiptHash,
      issuedAtMs,
      expiresAtMs,
      redeemedAtMs,
    },
  };
}

/**
 * One federated sign-in as defined by the start, OAuth/SAML callback and finish operations in
 * `openapi/internal/identity-service.yaml`. The persisted claim precedes provider I/O. The finish
 * transaction consumes its receipt while applying the current local sign-in decision.
 */
export class FederatedSignInFlow {
  // #region Properties
  /** The state for persistence, detached from the aggregate. */
  public get snapshot(): FederatedSignInFlowState {
    return structuredClone(this.state);
  }
  // #endregion

  // #region Constructor
  /** Accepts only a checked, detached state. */
  private constructor(private readonly state: FederatedSignInFlowState) {}
  // #endregion

  // #region Methods
  /** Issues a browser-bound state that is valid for ten minutes. */
  public static issue(input: FederatedFlowIssue, now: Date): FederatedSignInFlow {
    const issuedAtMs = now.getTime();
    return this.restore({
      ...input,
      issuedAtMs,
      expiresAtMs: issuedAtMs + flowLifetimeMs,
      phase: { kind: 'open' },
    });
  }

  /** Refuses malformed persisted credentials, phases or lifetimes. */
  public static restore(state: FederatedSignInFlowState): FederatedSignInFlow {
    const {
      id,
      connection,
      issuedAtMs,
      expiresAtMs,
      phase,
      stateHash,
      browserBindingHash,
      persistent,
    } = state;
    const { provider, issuer } = connection;
    if (
      id.trim().length === 0 ||
      !sha256Hex.test(stateHash) ||
      !sha256Hex.test(browserBindingHash) ||
      stateHash === browserBindingHash ||
      typeof persistent !== 'boolean' ||
      !supportedProviders.includes(provider) ||
      issuer.trim().length === 0 ||
      (provider === 'saml' &&
        (connection.organizationId.trim().length === 0 ||
          connection.connectionId.trim().length === 0)) ||
      !validLifetime(issuedAtMs, expiresAtMs, flowLifetimeMs) ||
      (phase.kind !== 'open' && !timeWithin(phase.claimedAtMs, issuedAtMs, expiresAtMs))
    ) {
      throw new FederatedSignInRefusedError();
    }
    if (phase.kind === 'complete') {
      const receipt = phase.continuation;
      if (
        !sha256Hex.test(receipt.receiptHash) ||
        receipt.receiptHash === stateHash ||
        receipt.receiptHash === browserBindingHash ||
        !isSameConnection(connection, receipt.identity) ||
        receipt.identity.subject.trim().length === 0 ||
        receipt.linkId.trim().length === 0 ||
        receipt.userId.trim().length === 0 ||
        (receipt.memberId !== undefined &&
          (provider !== 'saml' || receipt.memberId.trim().length === 0)) ||
        !timeWithin(receipt.issuedAtMs, phase.claimedAtMs, expiresAtMs) ||
        !validLifetime(receipt.issuedAtMs, receipt.expiresAtMs, receiptLifetimeMs) ||
        (receipt.redeemedAtMs !== null &&
          !timeWithin(receipt.redeemedAtMs, receipt.issuedAtMs, receipt.expiresAtMs))
      ) {
        throw new FederatedSignInRefusedError();
      }
    }
    return new FederatedSignInFlow({
      id,
      connection:
        provider === 'saml'
          ? {
              provider,
              issuer,
              organizationId: connection.organizationId,
              connectionId: connection.connectionId,
            }
          : { provider, issuer },
      stateHash,
      browserBindingHash,
      persistent,
      issuedAtMs,
      expiresAtMs,
      phase: persistedPhase(phase),
    });
  }

  /** Claims once for this provider and browser, even when the provider later refuses the login. */
  public claim(callback: FederatedCallbackBinding, now: Date): FederatedSignInFlow {
    const claimedAtMs = now.getTime();
    const { connection, phase, issuedAtMs, expiresAtMs, stateHash, browserBindingHash } =
      this.state;
    if (
      phase.kind !== 'open' ||
      callback.provider !== connection.provider ||
      callback.stateHash !== stateHash ||
      callback.browserBindingHash !== browserBindingHash ||
      !timeWithin(claimedAtMs, issuedAtMs, expiresAtMs)
    ) {
      throw new FederatedSignInRefusedError();
    }
    return FederatedSignInFlow.restore({ ...this.state, phase: { kind: 'claimed', claimedAtMs } });
  }

  /** Issues one two-minute receipt for a verified provider proof and its existing account link. */
  public complete(
    proof: VerifiedFederatedIdentity,
    link: LinkedFederatedAccount | null,
    receiptHash: string,
    now: Date,
    memberId?: string,
  ): FederatedSignInFlow {
    const { connection, phase, expiresAtMs } = this.state;
    const issuedAtMs = now.getTime();
    const identity = identityOf(connection, proof.subject);
    if (
      phase.kind !== 'claimed' ||
      !timeWithin(issuedAtMs, phase.claimedAtMs, expiresAtMs) ||
      !isSameConnection(connection, proof.connection) ||
      !isExistingLink(link, identity) ||
      (connection.provider === 'saml' && memberId === undefined)
    ) {
      throw new FederatedSignInRefusedError();
    }
    return FederatedSignInFlow.restore({
      ...this.state,
      phase: {
        kind: 'complete',
        claimedAtMs: phase.claimedAtMs,
        continuation: {
          identity,
          linkId: link.id,
          userId: link.userId,
          ...(memberId === undefined ? {} : { memberId }),
          receiptHash,
          issuedAtMs,
          expiresAtMs: issuedAtMs + receiptLifetimeMs,
          redeemedAtMs: null,
        },
      },
    });
  }

  /** Consumes a matching receipt once, including when current account policy returns a refusal. */
  public redeem(
    receiptHash: string,
    current: FederatedFinishAuthority,
    now: Date,
  ): FederatedSignInRedemption {
    const { phase } = this.state;
    const redeemedAtMs = now.getTime();
    if (
      phase.kind !== 'complete' ||
      phase.continuation.receiptHash !== receiptHash ||
      phase.continuation.redeemedAtMs !== null ||
      !timeWithin(redeemedAtMs, phase.continuation.issuedAtMs, phase.continuation.expiresAtMs)
    ) {
      throw new FederatedSignInRefusedError();
    }
    const receipt = phase.continuation;
    const flow = FederatedSignInFlow.restore({
      ...this.state,
      phase: { ...phase, continuation: { ...receipt, redeemedAtMs } },
    });
    return { flow, decision: this.decide(receipt, current) };
  }

  /** Revalidates the same link and account, bound membership and applicable two-step policy. */
  private decide(
    receipt: Continuation,
    current: FederatedFinishAuthority,
  ): FederatedSignInDecision {
    const { connection } = this.state;
    const organizationId = connection.provider === 'saml' ? connection.organizationId : null;
    if (
      !isExistingLink(current.link, receipt.identity) ||
      current.link.id !== receipt.linkId ||
      current.link.userId !== receipt.userId ||
      current.account?.id !== receipt.userId ||
      !current.account.enabled ||
      !current.maySignIn ||
      !twoStepDecisions.includes(current.twoStep) ||
      (organizationId !== null &&
        (receipt.memberId === undefined ||
          current.activeMembership?.organizationId !== organizationId ||
          current.activeMembership.userId !== receipt.userId ||
          current.activeMembership.memberId !== receipt.memberId))
    ) {
      return { kind: 'refused' };
    }
    return {
      kind: current.twoStep === 'challenge-required' ? 'challenge' : 'session',
      userId: receipt.userId,
      organizationId,
      persistent: this.state.persistent,
      audit: { flowId: this.state.id, linkId: receipt.linkId, provider: connection.provider },
    };
  }
  // #endregion
}
