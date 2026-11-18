/**
 * Type SessionAuthenticationMethod
 *
 * @description
 * How the person of a session last proved who they are ("Recent authentication" of
 * `openapi/internal/identity-service.yaml`, P2c-2): `password` for a first factor (the sign-in of
 * an account without two-step verification, by password or by e-mail code, a confirmed password,
 * the current password of a change), `two-step` for a second factor (the answer of a sign-in
 * challenge, a code of the authenticator app, the code that confirms the app).
 *
 * @type {'password' | 'two-step'}
 */
export type SessionAuthenticationMethod = 'password' | 'two-step';
