import { ringLngSpan } from './fixGeojsonAntimeridian';

describe('ringLngSpan', () => {
  it('считает размах кольца по долготе', () => {
    expect(
      ringLngSpan([
        [10, 0],
        [40, 1],
        [25, 2],
        [10, 0],
      ]),
    ).toBe(30);
  });
});
