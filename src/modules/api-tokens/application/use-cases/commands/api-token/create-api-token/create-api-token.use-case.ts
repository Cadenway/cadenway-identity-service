import { ApiToken } from '../../../../../domain/aggregates/api-token/api-token.aggregate.js';
import type { ApiTokenDraft } from '../../../../../domain/value-objects/api-token/api-token-draft.value-object.js';
import { toApiTokenView } from '../../../../mappers/api-token/api-token-view.mapper.js';
import type { IssuedApiToken } from '../../../../models/api-token/issued-api-token.model.js';
import { ReauthenticationRequired } from '../../../../models/api-token/reauthentication-required.model.js';
import { SessionNotFound } from '../../../../models/api-token/session-not-found.model.js';
import type { ApiTokenRepository } from '../../../../ports/outbound/persistence/api-token/api-token-repository.port.js';
import type { ApiTokenSecrets } from '../../../../ports/outbound/security/api-token/api-token-secrets.port.js';
import type { RecentAuthentications } from '../../../../ports/outbound/sessions/api-token/recent-authentications.port.js';
import type { Clock } from '../../../../ports/outbound/time/api-token/clock.port.js';
import type { ApiTokensUnitOfWork } from '../../../../ports/outbound/transactions/api-token/api-tokens-unit-of-work.port.js';
import type { CreateApiTokenInput } from './create-api-token.input.js';
import type { CreateApiTokenOutput } from './create-api-token.output.js';

/**
 * Class CreateApiToken
 *
 * @description
 * Creates a personal API token of the actor in the current organization of its session
 * (`POST /internal/v1/api-tokens`, P2b plan, decision 6) and returns its secret once. The secret is
 * drawn and hashed before the transaction; only its SHA-256 hash and its first 11 characters are
 * stored, in the tenant transaction of the organization of the internal token. Only a session
 * reaches this route: the gateway refuses a personal token on it.
 *
 * The creation requires a recent authentication of the session of the request (decision 4 of
 * P2c): a request without `sessionId`, or whose session has no authentication in the last 10
 * minutes, answers `auth.reauthentication-required` and creates nothing; a session that is not an
 * open session of the actor acting on that organization answers `session.not-found`. The check
 * joins the tenant transaction, so it commits with the creation.
 */
export class CreateApiToken {
  // #region Properties
  /**
   * Property unitOfWork
   *
   * @description
   * The tenant transaction of the creation.
   *
   * @type {ApiTokensUnitOfWork}
   * @readonly
   */
  private readonly unitOfWork: ApiTokensUnitOfWork;

  /**
   * Property secrets
   *
   * @description
   * Draws the secret.
   *
   * @type {ApiTokenSecrets}
   * @readonly
   */
  private readonly secrets: ApiTokenSecrets;

  /**
   * Property recentAuthentications
   *
   * @description
   * The recent authentication of the session of the request.
   *
   * @type {RecentAuthentications}
   * @readonly
   */
  private readonly recentAuthentications: RecentAuthentications;

  /**
   * Property clock
   *
   * @description
   * The time of the creation.
   *
   * @type {Clock}
   * @readonly
   */
  private readonly clock: Clock;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Takes the ports of the creation.
   *
   * @param {ApiTokensUnitOfWork} unitOfWork - The tenant transaction of the creation.
   * @param {ApiTokenSecrets} secrets - Draws the secret.
   * @param {RecentAuthentications} recentAuthentications - The recent authentication of the
   * session.
   * @param {Clock} clock - The time of the creation.
   * @constructor
   */
  public constructor(
    unitOfWork: ApiTokensUnitOfWork,
    secrets: ApiTokenSecrets,
    recentAuthentications: RecentAuthentications,
    clock: Clock,
  ) {
    this.unitOfWork = unitOfWork;
    this.secrets = secrets;
    this.recentAuthentications = recentAuthentications;
    this.clock = clock;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Creates the token.
   *
   * @param {CreateApiTokenInput} input - The actor, its organization, its session, the name, the
   * scopes and the lifetime.
   * @returns {Promise<CreateApiTokenOutput>} The token and its secret.
   * @throws {ReauthenticationRequired} Without a recent authentication of the session.
   * @throws {SessionNotFound} When the session is not an open session of the actor.
   * @throws {InvalidApiTokenError} When the name or the scopes break a rule the schema of the
   * route already checks.
   */
  public async execute(input: CreateApiTokenInput): Promise<CreateApiTokenOutput> {
    const sessionId: string | null = input.sessionId;
    if (sessionId === null) {
      throw new ReauthenticationRequired();
    }
    const issued: IssuedApiToken = this.secrets.issue();
    const draft: ApiTokenDraft = ApiToken.create(
      {
        organizationId: input.organizationId,
        userId: input.actorUserId,
        name: input.name,
        scopes: input.scopes,
        expiration: input.expiration,
        prefix: issued.prefix,
      },
      this.clock.now(),
    );
    const token: ApiToken = await this.unitOfWork.run(
      async (tokens: ApiTokenRepository): Promise<ApiToken> => {
        const status: 'recent' | 'stale' | 'not-found' = await this.recentAuthentications.check(
          input.actorUserId,
          sessionId,
        );
        if (status === 'not-found') {
          throw new SessionNotFound();
        }
        if (status === 'stale') {
          throw new ReauthenticationRequired();
        }
        return tokens.insert(draft, issued.tokenHash);
      },
    );
    return { apiToken: toApiTokenView(token), secret: issued.secret };
  }
  // #endregion
}
