import { describe, expect, it } from 'vitest';

import { DiscoverSignInMethods } from './discover-sign-in-methods.js';

describe('DiscoverSignInMethods', () => {
  it('offers the password then the email code to every address', () => {
    const discover: DiscoverSignInMethods = new DiscoverSignInMethods();

    expect(discover.execute({ email: 'camille.martin@ateliernord.fr' })).toEqual({
      methods: [{ type: 'password' }, { type: 'email-code' }],
    });
    expect(discover.execute({ email: 'nobody@ateliernord.fr' })).toEqual(
      discover.execute({ email: 'camille.martin@ateliernord.fr' }),
    );
  });
});
