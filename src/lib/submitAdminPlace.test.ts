import { adminPlacesDeleteUrlFromPlacesPostUrl } from './submitAdminPlace';

describe('adminPlacesDeleteUrlFromPlacesPostUrl', () => {
  it('вешает /delete и снимает хвостовой слэш', () => {
    expect(adminPlacesDeleteUrlFromPlacesPostUrl('https://api.test/places/')).toBe(
      'https://api.test/places/delete',
    );
  });
});
