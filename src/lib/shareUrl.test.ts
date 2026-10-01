import { mapPageUrl, mapShareUrl } from './shareUrl';

describe('mapPageUrl / mapShareUrl', () => {
  it('собирает путь карты с закодированным username', () => {
    expect(mapPageUrl('mike')).toBe('/mike');
    expect(mapPageUrl('user name')).toBe('/user%20name');
  });

  it('для шаринга берёт API /share, если задан VITE_API_BASE_URL', () => {
    expect(mapShareUrl('mike')).toBe('https://api.example.test/share/mike');
  });
});
