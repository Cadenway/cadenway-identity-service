/** Current owner and avatar generation, with the decision instant provided by the caller. */
export interface AvatarUploadContext {
  // #region Properties
  /** Account id from the verified actor, never from its selected organization. */
  readonly userId: string;

  /** Current account avatar fence, as read by the owning operation. */
  readonly generation: number;

  /** Instant used for the exclusive reservation expiry check. */
  readonly now: Date;
  // #endregion
}
