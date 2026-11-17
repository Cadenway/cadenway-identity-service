/**
 * Constant TENANT_UNIT_OF_WORK
 *
 * @description
 * Identifies the `MembershipsUnitOfWork` of the member event handlers, on the tenant runner.
 *
 * @type {unique symbol}
 */
export const TENANT_UNIT_OF_WORK: unique symbol = Symbol('TenantMembershipsUnitOfWork');
