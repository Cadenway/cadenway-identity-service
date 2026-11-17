/**
 * Type MemberRole
 *
 * @description
 * Role of a member in an organization, as `Role` of `asyncapi/organization-service.yaml` names it:
 * `owner` ("Propriétaire"), `admin` ("Administrateur"), `member` ("Membre") or `guest`
 * ("Invité"). Another role takes a new versioned event name, so the set is closed here.
 *
 * @type {'owner' | 'admin' | 'member' | 'guest'}
 */
export type MemberRole = 'owner' | 'admin' | 'member' | 'guest';
