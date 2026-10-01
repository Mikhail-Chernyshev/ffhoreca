import { apiBaseUrl, mediaUrl } from './apiBase';

describe('apiBaseUrl / mediaUrl', () => {
  it('отдаёт базовый URL без хвостового слэша', () => {
    expect(apiBaseUrl()).toBe('https://api.example.test');
  });

  it('абсолютный URL картинки не трогает, относительный дописывает API', () => {
    expect(mediaUrl('https://cdn.test/a.jpg')).toBe('https://cdn.test/a.jpg');
    expect(mediaUrl('/uploads/a.jpg')).toBe('https://api.example.test/uploads/a.jpg');
    expect(mediaUrl('')).toBe('');
  });
});
