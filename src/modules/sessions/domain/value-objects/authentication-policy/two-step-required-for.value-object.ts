/**
 * Type TwoStepRequiredFor
 *
 * @description
 * Who must have two-step verification to act on an organization (decision 8 of P2c,
 * `AuthenticationPolicy.twoStepVerificationRequiredFor`): `nobody`, `admins` (the owner and the
 * admins, "Exiger la vérification en deux étapes des administrateurs") or `everyone` ("L’exiger
 * pour tous les membres", guests included).
 *
 * @type {'nobody' | 'admins' | 'everyone'}
 */
export type TwoStepRequiredFor = 'nobody' | 'admins' | 'everyone';
