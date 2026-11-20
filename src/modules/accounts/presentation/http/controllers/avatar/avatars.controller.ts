import type {
  CurrentAvatarReference,
  ProfileMediaReservation,
  ProfileMediaReservationState,
} from '@cadenway/contracts/types/internal/identity-service';
import {
  GetAvatarUploadStateInternalParams,
  ReserveAvatarUploadInternalBody,
  ReserveAvatarUploadInternalHeader,
  ReserveAvatarUploadInternalParams,
  SetAvatarInternalBody,
  SetAvatarInternalHeader,
} from '@cadenway/contracts/validators/internal/identity-service';
import {
  InternalAccess,
  ProblemException,
  formatEtag,
  getOrganizationContext,
  zodDto,
} from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { PublishAvatar } from '../../../../application/use-cases/commands/avatar/publish-avatar/publish-avatar.use-case.js';
import { RemoveAvatar } from '../../../../application/use-cases/commands/avatar/remove-avatar/remove-avatar.use-case.js';
import { ReserveAvatarUpload } from '../../../../application/use-cases/commands/avatar/reserve-avatar-upload/reserve-avatar-upload.use-case.js';
import { GetAvatarReference } from '../../../../application/use-cases/queries/avatar/get-avatar-reference/get-avatar-reference.use-case.js';
import { GetAvatarUpload } from '../../../../application/use-cases/queries/avatar/get-avatar-upload/get-avatar-upload.use-case.js';
import { answerAvatarRefusals } from '../../errors/avatar/avatar-refusal.problem.js';

class AvatarOwnerPath extends zodDto(ReserveAvatarUploadInternalParams) {}
class AvatarUploadPath extends zodDto(GetAvatarUploadStateInternalParams) {}
class PublishAvatarBody extends zodDto(SetAvatarInternalBody) {}

// Identity's upload policy answers 422 for an unsupported encoding or a declaration above 5 MiB.
class ReserveAvatarBody extends zodDto(
  ReserveAvatarUploadInternalBody.extend({
    contentType: z.string(),
    sizeBytes: z.number().int().positive(),
  }),
) {}

function invalidHeader(header: 'Idempotency-Key' | 'If-Match'): ProblemException {
  return new ProblemException({
    status: 400,
    code: 'request.invalid',
    details: { issues: [{ in: 'header', path: header, code: 'invalid_format' }] },
  });
}

function requestKey(header: string | undefined): string | undefined {
  const validation = ReserveAvatarUploadInternalHeader.safeParse({ 'Idempotency-Key': header });
  if (!validation.success) throw invalidHeader('Idempotency-Key');
  return validation.data['Idempotency-Key'];
}

function currentVersion(header: string | undefined): number | undefined {
  if (header === undefined) return undefined;
  if (!SetAvatarInternalHeader.safeParse({ 'If-Match': header }).success) {
    throw invalidHeader('If-Match');
  }
  const version = Number(header.slice(1, -1));
  if (!Number.isSafeInteger(version)) throw invalidHeader('If-Match');
  return version;
}

function userScope(): { readonly actorUserId: string; readonly organizationId: string | null } {
  const context = getOrganizationContext();
  if (context?.actor.type !== 'user' || context.actor.id === null) {
    throw new ProblemException({ status: 403, code: 'auth.actor-not-allowed' });
  }
  return { actorUserId: context.actor.id, organizationId: context.organizationId };
}

/** Exposes Identity's owner-scoped avatar operations to the API gateway. */
@Controller('internal/v1/users/:userId')
@InternalAccess({ issuers: ['api-gateway'], actors: ['user'], organization: 'optional' })
export class AvatarsController {
  // #region Constructor
  /** Binds the account avatar operations. */
  public constructor(
    private readonly reserveUpload: ReserveAvatarUpload,
    private readonly getUpload: GetAvatarUpload,
    private readonly publishAvatar: PublishAvatar,
    private readonly removeAvatar: RemoveAvatar,
    private readonly getReference: GetAvatarReference,
  ) {}
  // #endregion

  // #region Methods
  /** Creates or replays the same authorized owner reservation. */
  @Post('avatar/uploads')
  @HttpCode(201)
  public async reserve(
    @Param() path: AvatarOwnerPath,
    @Body() body: ReserveAvatarBody,
    @Headers('idempotency-key') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProfileMediaReservation> {
    const { actorUserId } = userScope();
    const key = requestKey(header);
    const reservation = await answerAvatarRefusals(() =>
      this.reserveUpload.execute({
        actorUserId,
        userId: path.userId,
        contentType: body.contentType,
        sizeBytes: body.sizeBytes,
        ...(key === undefined ? {} : { idempotencyKey: key }),
      }),
    );
    response.setHeader(
      'Location',
      `/internal/v1/users/${path.userId.toLowerCase()}/avatar/uploads/${reservation.uploadId}`,
    );
    return { uploadId: reservation.uploadId, expiresAt: reservation.expiresAt.toISOString() };
  }

  /** Reports whether preparation is permissible or already committed. */
  @Get('avatar/uploads/:uploadId')
  public async upload(
    @Param() path: AvatarUploadPath,
    @Req() request: Request,
  ): Promise<ProfileMediaReservationState> {
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];
    const { actorUserId } = userScope();
    const result = await answerAvatarRefusals(() =>
      this.getUpload.execute({ actorUserId, userId: path.userId, uploadId: path.uploadId }),
    );
    return {
      uploadId: result.uploadId,
      state: result.state,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /** Publishes an upload that the signed gateway has prepared in Storage. */
  @Put('avatar')
  @HttpCode(204)
  public async publish(
    @Param() path: AvatarOwnerPath,
    @Body() body: PublishAvatarBody,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { actorUserId } = userScope();
    const expectedVersion = currentVersion(header);
    const result = await answerAvatarRefusals(() =>
      this.publishAvatar.execute({
        actorUserId,
        userId: path.userId,
        uploadId: body.uploadId,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      }),
    );
    response.setHeader('ETag', formatEtag(result.version));
  }

  /** Clears the account reference and returns the current profile version. */
  @Delete('avatar')
  @HttpCode(204)
  public async remove(
    @Param() path: AvatarOwnerPath,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { actorUserId } = userScope();
    const expectedVersion = currentVersion(header);
    const result = await answerAvatarRefusals(() =>
      this.removeAvatar.execute({
        actorUserId,
        userId: path.userId,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      }),
    );
    response.setHeader('ETag', formatEtag(result.version));
  }

  /** Returns only the opaque avatar reference after the gateway's membership check. */
  @Get('avatar-reference')
  public async reference(
    @Param() path: AvatarOwnerPath,
    @Req() request: Request,
  ): Promise<CurrentAvatarReference> {
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];
    const scope = userScope();
    return answerAvatarRefusals(() => this.getReference.execute({ ...scope, userId: path.userId }));
  }
  // #endregion
}
