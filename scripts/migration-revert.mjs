#!/usr/bin/env node
/**
 * `pnpm migration:revert` has nothing to run: Drizzle generates forward migrations only.
 *
 * Rollbacks follow the expand/contract rule of this repository instead. Every migration keeps the
 * previously deployed version working, so reverting a release means redeploying the previous image;
 * undoing a schema change means writing a new forward migration.
 */
console.error(
  [
    'migration:revert is not available: Drizzle generates no down migration.',
    'Roll back by redeploying the previous version (every migration stays compatible with it),',
    'or write a new forward migration with `pnpm migration:generate`.',
  ].join('\n'),
);
process.exit(1);
