/** An actual account avatar reference change, from `user.avatar-changed.v1` in Identity AsyncAPI. */
export interface AvatarChanged {
  // #region Properties
  /** Account that owns the avatar independently of any organization. */
  readonly userId: string;

  /** Monotonic avatar generation after this change, separate from the account version. */
  readonly generation: number;

  /** Current and retired opaque immutable asset ids. */
  readonly assetId: string | null;
  readonly oldAssetId: string | null;
  // #endregion
}
