import type { Catalog, TravelRoute } from '../data/types';
import { countedCountryCodes } from '../data/selectors';
import type { AppLocale } from '../i18n/localeStore';
import { worldCoveragePercent } from './travelPassport';

export const POSTCARD_WIDTH = 1080;
export const POSTCARD_HEIGHT = 1350;

const FLAG_ASPECT = 4 / 3;
const MIN_FLAG_H = 32;

const C = {
  paper: '#f6f1e8',
  paperDeep: '#ebe4d6',
  ink: '#2a221c',
  inkMuted: '#7a7268',
  band: '#93371c',
  accent: '#d4532c',
  gold: '#c9a227',
  cream: '#fff8f2',
  route: '#c85a32',
  white: '#fffcf8',
} as const;

export type PostcardData = {
  name: string;
  username: string | null;
  percent: number;
  countries: number;
  cities: number;
  places: number;
  routes: number;
  countryCodes: string[];
  routeFrom: string | null;
  routeTo: string | null;
  locale: AppLocale;
  mapUrl: string;
};

export type FlagGrid = {
  cols: number;
  rows: number;
  flagW: number;
  flagH: number;
  shown: number;
  extra: number;
  gap: number;
};

type Copy = {
  airline: string;
  pass: string;
  world: string;
  countries: string;
  cities: string;
  routes: string;
  from: string;
  to: string;
};

const COPY: Record<AppLocale, Copy> = {
  ru: {
    airline: 'TIPS FROM TRIPS',
    pass: 'ПОСАДОЧНЫЙ ТАЛОН',
    world: 'мира',
    countries: 'стран',
    cities: 'городов',
    routes: 'маршрутов',
    from: 'Откуда',
    to: 'Куда',
  },
  en: {
    airline: 'TIPS FROM TRIPS',
    pass: 'BOARDING PASS',
    world: 'of the world',
    countries: 'countries',
    cities: 'cities',
    routes: 'routes',
    from: 'From',
    to: 'To',
  },
};

export function latestRouteLeg(
  routes: TravelRoute[],
): { from: string; to: string } | null {
  for (let i = routes.length - 1; i >= 0; i--) {
    const wp = routes[i]?.waypoints ?? [];
    if (wp.length < 2) continue;
    const from = wp[0]?.name?.trim();
    const to = wp[wp.length - 1]?.name?.trim();
    if (from && to) return { from, to };
  }
  return null;
}

export function postcardFilename(username: string | null): string {
  const slug = (username ?? 'map')
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, 40);
  return `tips-from-trips-${slug || 'map'}.png`;
}

export function flagGridLayout(
  count: number,
  width: number,
  height: number,
  gap = 10,
): FlagGrid {
  const empty: FlagGrid = {
    cols: 0,
    rows: 0,
    flagW: 0,
    flagH: 0,
    shown: 0,
    extra: 0,
    gap,
  };
  if (count <= 0 || width <= 0 || height <= 0) return empty;

  const maxCols = Math.min(10, count);
  let best: FlagGrid | null = null;
  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = Math.ceil(count / cols);
    const flagW = (width - gap * (cols - 1)) / cols;
    const flagH = flagW / FLAG_ASPECT;
    const totalH = rows * flagH + gap * (rows - 1);
    if (totalH <= height + 0.5 && flagH >= MIN_FLAG_H) {
      if (!best || flagW > best.flagW) {
        best = { cols, rows, flagW, flagH, shown: count, extra: 0, gap };
      }
    }
  }
  if (best) return best;

  for (let cols = Math.min(8, Math.max(2, count)); cols >= 2; cols--) {
    const flagW = (width - gap * (cols - 1)) / cols;
    const flagH = flagW / FLAG_ASPECT;
    if (flagH < MIN_FLAG_H) continue;
    const rows = Math.max(1, Math.floor((height + gap) / (flagH + gap)));
    const capacity = cols * rows;
    if (capacity < 2) continue;
    if (count <= capacity) {
      return {
        cols,
        rows: Math.ceil(count / cols),
        flagW,
        flagH,
        shown: count,
        extra: 0,
        gap,
      };
    }
    const shown = capacity - 1;
    return { cols, rows, flagW, flagH, shown, extra: count - shown, gap };
  }

  return {
    cols: 1,
    rows: 1,
    flagW: Math.min(width, 48),
    flagH: Math.min(height, 36),
    shown: 1,
    extra: Math.max(0, count - 1),
    gap,
  };
}

export function buildPostcardData(input: {
  name: string;
  username: string | null;
  catalog: Catalog;
  routes: TravelRoute[];
  transit: ReadonlySet<string>;
  locale: AppLocale;
  mapUrl: string;
}): PostcardData {
  const codes = [...countedCountryCodes(input.catalog, input.transit)].sort();
  const leg = latestRouteLeg(input.routes);
  return {
    name: input.name.trim() || input.username || 'Tips from trips',
    username: input.username,
    percent: worldCoveragePercent(codes.length),
    countries: codes.length,
    cities: input.catalog.cities.length,
    places: input.catalog.places.length,
    routes: input.routes.length,
    countryCodes: codes,
    routeFrom: leg?.from ?? null,
    routeTo: leg?.to ?? null,
    locale: input.locale,
    mapUrl: input.mapUrl,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function setTracking(ctx: CanvasRenderingContext2D, value: string) {
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      value;
  }
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  weight = '700',
): number {
  let size = maxSize;
  while (size > 18) {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  return size;
}

function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

function drawFlagPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  code: string,
) {
  ctx.fillStyle = C.paperDeep;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = C.inkMuted;
  ctx.font = `600 ${Math.max(10, Math.round(h * 0.32))}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, x + w / 2, y + h / 2);
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  code: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (img && img.naturalWidth > 0) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 6);
    ctx.clip();
    const ir = img.naturalWidth / img.naturalHeight;
    const fr = w / h;
    let dw = w;
    let dh = h;
    let dx = x;
    let dy = y;
    if (ir > fr) {
      dw = h * ir;
      dx = x - (dw - w) / 2;
    } else {
      dh = w / ir;
      dy = y - (dh - h) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  } else {
    drawFlagPlaceholder(ctx, x, y, w, h, code);
  }
  ctx.strokeStyle = 'rgba(42, 34, 28, 0.16)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
}

function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 3, 1, 2, 1, 4, 2, 1, 3, 2, 1, 1];
  const unit = w / 58;
  let cx = x;
  ctx.fillStyle = C.ink;
  for (let i = 0; i < 40; i++) {
    const bw = pattern[i % pattern.length] * unit;
    if (i % 2 === 0) ctx.fillRect(cx, y, bw, h);
    cx += bw;
  }
}

export function drawPostcard(
  canvas: HTMLCanvasElement,
  data: PostcardData,
  flags: ReadonlyMap<string, HTMLImageElement>,
): void {
  const w = POSTCARD_WIDTH;
  const h = POSTCARD_HEIGHT;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const copy = COPY[data.locale] ?? COPY.en;
  const pad = 72;
  const radius = 36;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  roundRect(ctx, 0, 0, w, h, radius);
  ctx.clip();

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, w, h);

  const bandH = 92;
  const band = ctx.createLinearGradient(0, 0, w, 0);
  band.addColorStop(0, C.band);
  band.addColorStop(1, C.accent);
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, bandH);

  ctx.fillStyle = C.white;
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  setTracking(ctx, '0.14em');
  ctx.fillText(copy.airline, pad, bandH / 2);
  ctx.textAlign = 'right';
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText(copy.pass, w - pad, bandH / 2);
  setTracking(ctx, '0px');

  let y = bandH + 56;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink;
  const nameSize = fitFont(ctx, data.name, w - pad * 2, 54);
  ctx.fillText(ellipsize(ctx, data.name, w - pad * 2), pad, y);
  y += nameSize + 10;

  if (data.username) {
    ctx.fillStyle = C.inkMuted;
    ctx.font = '600 26px Inter, system-ui, sans-serif';
    ctx.fillText(`@${data.username}`, pad, y);
    y += 46;
  } else {
    y += 18;
  }

  ctx.fillStyle = C.accent;
  ctx.font = '700 168px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  const pct = `${data.percent}%`;
  ctx.fillText(pct, pad - 6, y + 148);
  y += 168;

  ctx.fillStyle = C.inkMuted;
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillText(copy.world, pad, y);
  y += 36;

  const barW = w - pad * 2;
  const barH = 10;
  roundRect(ctx, pad, y, barW, barH, 6);
  ctx.fillStyle = 'rgba(147, 55, 28, 0.14)';
  ctx.fill();
  const fillW = Math.max(8, (barW * Math.min(100, data.percent)) / 100);
  ctx.fillStyle = C.accent;
  roundRect(ctx, pad, y, fillW, barH, 6);
  ctx.fill();
  y += 36;

  const hasRoute = !!(data.routeFrom && data.routeTo);
  const stubTop = h - 168;
  const statsY = stubTop - (hasRoute ? 148 : 72);
  const flagBottom = statsY - 28;
  const flagTop = y;
  const flagAreaH = Math.max(80, flagBottom - flagTop);
  const grid = flagGridLayout(data.countryCodes.length, w - pad * 2, flagAreaH, 12);

  if (grid.shown > 0) {
    const codes = data.countryCodes.slice(0, grid.shown);
    codes.forEach((code, i) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      const fx = pad + col * (grid.flagW + grid.gap);
      const fy = flagTop + row * (grid.flagH + grid.gap);
      drawFlag(ctx, flags.get(code), code, fx, fy, grid.flagW, grid.flagH);
    });
    if (grid.extra > 0) {
      const i = grid.shown;
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      const fx = pad + col * (grid.flagW + grid.gap);
      const fy = flagTop + row * (grid.flagH + grid.gap);
      ctx.fillStyle = C.paperDeep;
      roundRect(ctx, fx, fy, grid.flagW, grid.flagH, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(147, 55, 28, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = C.band;
      ctx.font = `700 ${Math.max(16, Math.round(grid.flagH * 0.38))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${grid.extra}`, fx + grid.flagW / 2, fy + grid.flagH / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  ctx.fillStyle = C.ink;
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const stats = [
    `${data.countries} ${copy.countries}`,
    `${data.cities} ${copy.cities}`,
    `${data.routes} ${copy.routes}`,
  ].join('  ·  ');
  ctx.fillText(ellipsize(ctx, stats, w - pad * 2), pad, statsY);

  if (hasRoute && data.routeFrom && data.routeTo) {
    const ry = statsY + 28;
    ctx.strokeStyle = 'rgba(147, 55, 28, 0.18)';
    ctx.setLineDash([5, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, ry);
    ctx.lineTo(w - pad, ry);
    ctx.stroke();
    ctx.setLineDash([]);

    const midX = w / 2;
    ctx.fillStyle = C.inkMuted;
    ctx.font = '700 16px Inter, system-ui, sans-serif';
    setTracking(ctx, '0.12em');
    ctx.fillText(copy.from.toUpperCase(), pad, ry + 36);
    ctx.textAlign = 'right';
    ctx.fillText(copy.to.toUpperCase(), w - pad, ry + 36);
    setTracking(ctx, '0px');

    ctx.fillStyle = C.ink;
    ctx.font = '700 34px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, data.routeFrom, midX - pad - 48), pad, ry + 82);
    ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, data.routeTo, midX - pad - 48), w - pad, ry + 82);

    ctx.textAlign = 'center';
    ctx.fillStyle = C.accent;
    ctx.font = '700 28px Inter, system-ui, sans-serif';
    ctx.fillText('✈', midX, ry + 72);
    ctx.beginPath();
    ctx.strokeStyle = C.route;
    ctx.lineWidth = 3;
    ctx.moveTo(midX - 86, ry + 58);
    ctx.quadraticCurveTo(midX, ry + 28, midX + 86, ry + 58);
    ctx.stroke();
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = C.paperDeep;
  ctx.fillRect(0, stubTop, w, h - stubTop);

  ctx.fillStyle = C.paper;
  ctx.beginPath();
  ctx.arc(0, stubTop, 18, 0, Math.PI * 2);
  ctx.arc(w, stubTop, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(147, 55, 28, 0.28)';
  ctx.setLineDash([7, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, stubTop);
  ctx.lineTo(w - 28, stubTop);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = C.band;
  ctx.font = '700 28px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  setTracking(ctx, '0.16em');
  ctx.fillText('TFT', pad, stubTop + 84);
  setTracking(ctx, '0px');

  drawBarcode(ctx, pad + 120, stubTop + 48, 420, 72);

  ctx.fillStyle = C.inkMuted;
  ctx.font = '600 20px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  const urlText = data.username
    ? `@${data.username}`
    : displayUrl(data.mapUrl) || 'tips from trips';
  ctx.fillText(ellipsize(ctx, urlText, 380), w - pad, stubTop + 72);
  ctx.font = '600 16px Inter, system-ui, sans-serif';
  ctx.fillText('tips from trips', w - pad, stubTop + 102);

  ctx.restore();

  ctx.strokeStyle = 'rgba(42, 34, 28, 0.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, w - 2, h - 2, radius);
  ctx.stroke();
}
