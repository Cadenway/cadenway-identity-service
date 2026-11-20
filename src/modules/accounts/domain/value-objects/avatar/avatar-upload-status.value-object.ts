/** Stored reservation status. Expiration and supersession are irreversible terminal refusals. */
export type AvatarUploadStatus = 'pending' | 'committed' | 'expired' | 'superseded';
