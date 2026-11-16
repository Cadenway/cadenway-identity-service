import type { CodeSent } from '@cadenway/contracts/types/internal/identity-service';

import type { CodeSentView } from '../../../../application/projections/authentication/code-sent-view.projection.js';

/**
 * Function toCodeSent
 *
 * @description
 * Maps the answer of a code request to `CodeSent`.
 *
 * @param {CodeSentView} view - The answer of the use case.
 * @returns {CodeSent} The body of the response.
 */
export function toCodeSent(view: CodeSentView): CodeSent {
  return {
    email: view.email,
    expiresAt: view.expiresAt.toISOString(),
    resendAvailableAt: view.resendAvailableAt.toISOString(),
  };
}
