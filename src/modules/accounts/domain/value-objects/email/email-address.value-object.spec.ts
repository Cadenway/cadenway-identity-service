import { describe, expect, it } from 'vitest';

import { InvalidEmailAddressError } from '../../errors/accounts/invalid-email-address.error.js';
import { EmailAddress } from './email-address.value-object.js';

describe('EmailAddress', () => {
  it('compares addresses without regard to case or surrounding spaces', () => {
    const camille: EmailAddress = EmailAddress.of('camille.martin@ateliernord.fr');

    expect(EmailAddress.of('  Camille.Martin@AtelierNord.FR ').equals(camille)).toBe(true);
    expect(EmailAddress.of('Camille.Martin@AtelierNord.FR').value).toBe(
      'camille.martin@ateliernord.fr',
    );
  });

  it('refuses an empty address, one without @ and one too long, without quoting it', () => {
    expect(() => EmailAddress.of('   ')).toThrow(InvalidEmailAddressError);
    expect(() => EmailAddress.of('camille')).toThrow(InvalidEmailAddressError);
    expect(() => EmailAddress.of('camille')).not.toThrow(/camille/u);
    expect(() => EmailAddress.of(`${'a'.repeat(250)}@ateliernord.fr`)).toThrow(
      InvalidEmailAddressError,
    );
  });
});
