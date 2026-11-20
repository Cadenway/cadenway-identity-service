import type { AvatarStore } from './avatar-store.port.js';

/** Owns the commit and rollback boundary of an account avatar operation. */
export interface AvatarUnitOfWork {
  // #region Methods
  /** Runs the operation in a single system transaction. */
  run<T>(
    work: (store: AvatarStore) => Promise<T>,
    options?: { readonly readOnly: boolean },
  ): Promise<T>;
  // #endregion
}
