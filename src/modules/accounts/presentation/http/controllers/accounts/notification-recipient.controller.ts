import type { NotificationRecipient } from '@cadenway/contracts/types/internal/identity-service';
import {
  GetNotificationRecipientInternalParams,
  GetNotificationRecipientInternalResponse,
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
import { isIanaTimeZone } from '../../validation/accounts/time-zone.validator.js';

class NotificationRecipientPath extends zodDto(GetNotificationRecipientInternalParams) {}

function assertUnscopedSystem(): void {
  const context = getOrganizationContext();
  if (
    context?.actor.type !== 'system' ||
    context.organizationId !== null ||
    context.role !== null ||
    context.scopes.length !== 0
  ) {
    throw new ProblemException({ status: 403, code: 'auth.actor-not-allowed' });
  }
}

function assertPathOnly(request: Request): void {
  if (
    Object.keys(request.query).length !== 0 ||
    Number(request.headers['content-length'] ?? 0) !== 0 ||
    request.headers['transfer-encoding'] !== undefined
  ) {
    throw new ProblemException({ status: 400, code: 'request.invalid' });
  }
}

function accountReadUnavailable(): ProblemException {
  return new ProblemException({ status: 503, code: 'upstream.unavailable' });
}

/** Exposes only the current verified delivery profile to Notification jobs. */
@Controller('internal/v1/users/:userId/notification-recipient')
@InternalAccess({ issuers: ['notification-service'], actors: ['system'], organization: 'optional' })
export class NotificationRecipientController {
  // #region Constructor
  /** Binds the current account recipient lookup. */
  public constructor(private readonly getRecipient: GetNotificationRecipient) {}
  // #endregion

  // #region Methods
  /** Returns one account's deliverable profile without allowing HTTP revalidation. */
  @Get()
  public async read(
    @Param() path: NotificationRecipientPath,
    @Req() request: Request,
  ): Promise<NotificationRecipient> {
    assertUnscopedSystem();
    assertPathOnly(request);
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];

    const recipient = await this.getRecipient.execute(path.userId).catch(() => {
      throw accountReadUnavailable();
    });
    if (recipient === null) throw new ProblemException({ status: 404, code: 'user.not-found' });
    const response = GetNotificationRecipientInternalResponse.safeParse(recipient);
    if (!response.success || !isIanaTimeZone(response.data.timeZone)) {
      throw accountReadUnavailable();
    }
    return response.data;
  }
  // #endregion
}
