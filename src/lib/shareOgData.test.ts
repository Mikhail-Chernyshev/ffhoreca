import { latestShareRouteLeg, shareOgEtag } from '../../server/src/shareOgData';
import { isLinkPreviewCrawler } from '../../server/src/sharePage';
import type { TravelRoute } from '../data/types';

describe('shareOgData', () => {
  it('берёт последнюю ногу маршрута', () => {
    const routes: TravelRoute[] = [
      {
        id: 'a',
        mode: 'plane',
        waypoints: [
          { cityId: '1', name: 'Tbilisi', lat: 0, lng: 0 },
          { cityId: '2', name: 'Rome', lat: 0, lng: 0 },
        ],
      },
      {
        id: 'b',
        mode: 'train',
        waypoints: [
          { cityId: '2', name: 'Rome', lat: 0, lng: 0 },
          { cityId: '3', name: 'Paris', lat: 0, lng: 0 },
        ],
      },
    ];
    expect(latestShareRouteLeg(routes)).toEqual({ from: 'Rome', to: 'Paris' });
  });

  it('etag меняется от стран', () => {
    const base = {
      name: 'Misha',
      username: 'mike',
      cities: 2,
      routes: 1,
      routeFrom: 'Tbilisi',
      routeTo: 'Rome',
    };
    expect(shareOgEtag({ ...base, countryCodes: ['GE'] })).not.toBe(
      shareOgEtag({ ...base, countryCodes: ['GE', 'IT'] }),
    );
  });
});

describe('isLinkPreviewCrawler', () => {
  it('узнаёт TelegramBot и не путает in-app Telegram', () => {
    expect(isLinkPreviewCrawler('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isLinkPreviewCrawler('Mozilla/5.0 Telegram')).toBe(false);
  });
});
