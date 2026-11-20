import { ProblemException } from '@cadenway/nest-common';

import { AccountRefusal } from '../../../../application/models/authentication/account-refusal.model.js';
import { avatarRefusalOf } from '../../../../application/models/avatar/avatar-refusal.model.js';

/** Translates expected avatar refusals without exposing upload declarations or identifiers. */
export async function answerAvatarRefusals<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    if (error instanceof AccountRefusal && error.refusal.reason === 'user-not-found') {
      throw new ProblemException({ status: 404, code: 'user.not-found' });
    }
    const refusal = avatarRefusalOf(error);
    if (refusal === null) throw error;
    switch (refusal.reason) {
      case 'not-found':
        throw new ProblemException({ status: 404, code: 'media.not-found' });
      case 'file-too-large':
        throw new ProblemException({ status: 422, code: 'media.file-too-large' });
      case 'unsupported-type':
        throw new ProblemException({ status: 422, code: 'media.unsupported-type' });
      case 'key-reused':
        throw new ProblemException({ status: 422, code: 'idempotency.key-reused' });
      case 'expired':
        throw new ProblemException({ status: 409, code: 'media.upload-expired' });
      case 'superseded':
        throw new ProblemException({ status: 409, code: 'media.upload-superseded' });
      case 'version-mismatch':
        if (refusal.currentVersion === undefined) throw error;
        throw new ProblemException({
          status: 412,
          code: 'request.version-mismatch',
          details: { version: refusal.currentVersion },
        });
      case 'invalid-state':
        throw error;
    }
  }
}
