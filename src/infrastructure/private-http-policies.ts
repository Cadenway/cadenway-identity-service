import { ProblemException, toProblem } from '@cadenway/nest-common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

const recipientPath = /^\/internal\/v1\/users\/[^/]+\/notification-recipient\/?$/iu;

/** Whether Express can dispatch the request to the recipient GET handler. */
function isRecipientRequest(request: Request): boolean {
  return (
    (request.method === 'GET' || request.method === 'HEAD') && recipientPath.test(request.path)
  );
}

/** Install after the kit's JSON parser and before Nest registers the parameterized route. */
export function configurePrivateHttpPolicies(app: Pick<NestExpressApplication, 'use'>): void {
  app.use(
    [
      '/internal/v1/realtime/tickets',
      /^\/internal\/v1\/users\/[^/]+\/avatar(?:-reference|\/uploads(?:\/[^/]+)?)?\/?$/iu,
    ],
    (error: unknown, _request: Request, response: Response, next: NextFunction): void => {
      response.setHeader('Cache-Control', 'no-store');
      next(error);
    },
  );

  app.use((request: Request, response: Response, next: NextFunction): void => {
    if (isRecipientRequest(request)) {
      response.setHeader('Cache-Control', 'no-store');
      try {
        decodeURI(request.path);
      } catch {
        next(new ProblemException({ status: 400, code: 'request.invalid' }));
        return;
      }
    }
    next();
  });

  app.use((error: unknown, request: Request, response: Response, next: NextFunction): void => {
    if (isRecipientRequest(request)) {
      response.setHeader('Cache-Control', 'no-store');
      // The route has one client-input problem, with no parser diagnostics in its response.
      if (toProblem(error).status === 400) {
        next(new ProblemException({ status: 400, code: 'request.invalid' }));
        return;
      }
    }
    next(error);
  });
}
