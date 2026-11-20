/** The domain reasons an avatar declaration, stored state or transition can be refused. */
export type AvatarRefusalReason =
  | 'invalid-state'
  | 'not-found'
  | 'file-too-large'
  | 'unsupported-type'
  | 'key-reused'
  | 'expired'
  | 'superseded'
  | 'version-mismatch';
