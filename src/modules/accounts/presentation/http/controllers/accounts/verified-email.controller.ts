import type { VerifiedEmail } from '@cadenway/contracts/types/internal/identity-service';
import {
  GetVerifiedEmailInternalParams,
  GetVerifiedEmailInternalResponse,
} from '@cadenway/contracts/validators/internal/identity-service';
import {
  InternalAccess,
  ProblemException,
  getOrganizationContext,
  zodDto,
} from '@cadenway/nest-common';
import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';

import { GetNotificationRecipient } from '../../../../application/use-cases/queries/accounts/get-notification-recipient/get-notification-recipient.use-case.js';

class VerifiedEmailPath extends zodDto(GetVerifiedEmailInternalParams) {}

/** Gives Organization the current verified address needed to resolve addressed invitations. */
@Controller('internal/v1/users/:userId/verified-email')
@InternalAccess({ issuers: ['organization-service'], actors: ['system'], organization: 'optional' })
export class VerifiedEmailController {
  // #region Constructor
  /** Binds the lookup for the account's current verified email. */
  public constructor(private readonly verifiedAccounts: GetNotificationRecipient) {}
  // #endregion

  // #region Methods
  /** Returns only the verified email to Organization's unscoped system actor. */
  @Get()
  public async read(
    @Param() { userId }: VerifiedEmailPath,
    @Req() request: Request,
  ): Promise<VerifiedEmail> {
    const context = getOrganizationContext();
    if (
      context?.actor.type !== 'system' ||
      context.actor.id !== 'organization-service' ||
      context.organizationId !== null ||
      context.role !== null ||
      context.scopes.length !== 0
    ) {
      throw new ProblemException({ status: 403, code: 'auth.actor-not-allowed' });
    }
    if (
      Object.keys(request.query).length !== 0 ||
      Number(request.headers['content-length'] ?? 0) !== 0 ||
      request.headers['transfer-encoding'] !== undefined
    ) {
      throw new ProblemException({ status: 400, code: 'request.invalid' });
    }
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];

    const account = await this.verifiedAccounts.execute(userId).catch(() => {
      throw new ProblemException({ status: 503, code: 'upstream.unavailable' });
    });
    if (account === null) throw new ProblemException({ status: 404, code: 'user.not-found' });
    const response = GetVerifiedEmailInternalResponse.safeParse({ email: account.email });
    if (!response.success) {
      throw new ProblemException({ status: 503, code: 'upstream.unavailable' });
    }
    return response.data;
  }
  // #endregion
}
