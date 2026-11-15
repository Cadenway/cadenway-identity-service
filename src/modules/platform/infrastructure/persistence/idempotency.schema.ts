// Table of @cadenway/nest-common/database, re-exported so that drizzle-kit writes it into the
// migrations of this service: the key and the stored response of a route marked `@Idempotent()`,
// written in the transaction of the use case (`DatabaseModule` with `idempotency: true`). Its
// definition belongs to the kit and is never changed here.
export { idempotencyKeys } from '@cadenway/nest-common/database';
