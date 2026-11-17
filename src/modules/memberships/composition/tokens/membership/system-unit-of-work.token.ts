/**
 * Constant SYSTEM_UNIT_OF_WORK
 *
 * @description
 * Identifies the `MembershipsUnitOfWork` of the reading other modules consume, on the system
 * runner.
 *
 * @type {unique symbol}
 */
export const SYSTEM_UNIT_OF_WORK: unique symbol = Symbol('SystemMembershipsUnitOfWork');
