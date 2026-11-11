import { canSharePostcardFile } from './webShare';

describe('canSharePostcardFile', () => {
  const file = new File(['x'], 'card.png', { type: 'image/png' });

  it('false без navigator.share', () => {
    expect(canSharePostcardFile(file)).toBe(false);
  });
});
