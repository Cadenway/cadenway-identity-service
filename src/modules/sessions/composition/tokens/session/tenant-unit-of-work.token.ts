/**
 * Constant TENANT_UNIT_OF_WORK
 *
 * @description
 * Token of the tenant `SessionsUnitOfWork`, for the check of a request that carries an
 * organization.
 *
 * @type {unique symbol}
 */
export const TENANT_UNIT_OF_WORK: unique symbol = Symbol('TenantSessionsUnitOfWork');
