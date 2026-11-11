import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import { worldCoveragePercent } from '../../src/lib/travelPassport';
import { shareOgEtag, type ShareOgInput } from './shareOgData';

export { latestShareRouteLeg, shareOgEtag, type ShareOgInput } from './shareOgData';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const C = {
  paper: '#f6f1e8',
  paperDeep: '#ebe4d6',
  ink: '#2a221c',
  inkMuted: '#7a7268',
  band: '#93371c',
  accent: '#d4532c',
  cream: '#fff8f2',
} as const;

const FLAG_ALIAS: Record<string, string> = { UK: 'gb' };

let fontsReady = false;
function ensureFonts(): void {
  if (fontsReady) return;
  fontsReady = true;
  const paths = [
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
  ];
  for (const p of paths) {
    try {
      GlobalFonts.registerFromPath(p, 'OgSans');
    } catch {
      /* optional */
    }
  }
}

function font(weight: number, size: number): string {
  return `${weight} ${size}px OgSans, Arial, Helvetica, sans-serif`;
}

function roundRect(
  ctx: SKRSContext2D,
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

function ellipsize(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

async function loadFlags(codes: string[]): Promise<Map<string, Image>> {
  const out = new Map<string, Image>();
  await Promise.all(
    codes.map(async (code) => {
      const cc = (FLAG_ALIAS[code] ?? code).toLowerCase();
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 2500);
      try {
        const res = await fetch(`https://flagcdn.com/w80/${cc}.png`, { signal: ac.signal });
        if (!res.ok) return;
        const img = await loadImage(Buffer.from(await res.arrayBuffer()));
        out.set(code, img);
      } catch {
        /* skip */
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return out;
}

export async function renderShareOgPng(input: ShareOgInput): Promise<Buffer> {
  ensureFonts();
  const percent = worldCoveragePercent(input.countryCodes.length);
  const flags = await loadFlags(input.countryCodes.slice(0, 18));

  const w = OG_WIDTH;
  const h = OG_HEIGHT;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const pad = 56;

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = C.band;
  ctx.fillRect(0, 0, w, 72);
  ctx.fillStyle = C.cream;
  ctx.font = font(700, 22);
  ctx.textBaseline = 'middle';
  ctx.fillText('TIPS FROM TRIPS', pad, 36);
  ctx.textAlign = 'right';
  ctx.fillText('BOARDING PASS', w - pad, 36);
  ctx.textAlign = 'left';

  ctx.fillStyle = C.ink;
  ctx.font = font(800, 42);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(ellipsize(ctx, input.name, 620), pad, 148);
  ctx.fillStyle = C.inkMuted;
  ctx.font = font(600, 24);
  ctx.fillText(`@${input.username}`, pad, 186);

  ctx.fillStyle = C.accent;
  ctx.font = font(800, 132);
  ctx.fillText(`${percent}%`, pad - 4, 340);
  ctx.fillStyle = C.inkMuted;
  ctx.font = font(600, 22);
  ctx.fillText('of the world', pad, 378);

  const barY = 400;
  const barW = 560;
  roundRect(ctx, pad, barY, barW, 10, 5);
  ctx.fillStyle = 'rgba(147, 55, 28, 0.14)';
  ctx.fill();
  roundRect(ctx, pad, barY, Math.max(8, (barW * Math.min(100, percent)) / 100), 10, 5);
  ctx.fillStyle = C.accent;
  ctx.fill();

  const stats = `${input.countryCodes.length} countries  ·  ${input.cities} cities  ·  ${input.routes} routes`;
  ctx.fillStyle = C.ink;
  ctx.font = font(600, 22);
  ctx.fillText(ellipsize(ctx, stats, 620), pad, 456);

  if (input.routeFrom && input.routeTo) {
    ctx.fillStyle = C.inkMuted;
    ctx.font = font(700, 14);
    ctx.fillText('FROM', pad, 500);
    ctx.fillText('TO', pad + 300, 500);
    ctx.fillStyle = C.ink;
    ctx.font = font(700, 26);
    ctx.fillText(ellipsize(ctx, input.routeFrom, 270), pad, 536);
    ctx.fillText(ellipsize(ctx, input.routeTo, 270), pad + 300, 536);
  }

  const shown = input.countryCodes.slice(0, 18);
  const cols = 6;
  const fw = 68;
  const fh = 48;
  const gap = 10;
  const gridX = 700;
  const gridY = 118;
  shown.forEach((code, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (fw + gap);
    const y = gridY + row * (fh + gap);
    const img = flags.get(code);
    roundRect(ctx, x, y, fw, fh, 6);
    ctx.save();
    ctx.clip();
    if (img) {
      ctx.drawImage(img, x, y, fw, fh);
    } else {
      ctx.fillStyle = C.paperDeep;
      ctx.fillRect(x, y, fw, fh);
      ctx.fillStyle = C.inkMuted;
      ctx.font = font(700, 14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(code, x + fw / 2, y + fh / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(42, 34, 28, 0.16)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, fw, fh, 6);
    ctx.stroke();
  });
  if (input.countryCodes.length > shown.length) {
    const extra = input.countryCodes.length - shown.length;
    ctx.fillStyle = C.inkMuted;
    ctx.font = font(700, 18);
    ctx.fillText(`+${extra}`, gridX, gridY + 3 * (fh + gap) + 8);
  }

  ctx.fillStyle = C.paperDeep;
  ctx.fillRect(0, h - 58, w, 58);
  ctx.fillStyle = C.band;
  ctx.font = font(800, 20);
  ctx.textBaseline = 'middle';
  ctx.fillText('TFT', pad, h - 29);
  ctx.fillStyle = C.inkMuted;
  ctx.textAlign = 'right';
  ctx.font = font(600, 18);
  ctx.fillText(`tipsfromtrips.app/${input.username}`, w - pad, h - 29);

  return canvas.toBuffer('image/png');
}

const ogCache = new Map<string, { etag: string; png: Buffer }>();

export async function shareOgPngCached(input: ShareOgInput): Promise<{ png: Buffer; etag: string }> {
  const etag = shareOgEtag(input);
  const hit = ogCache.get(input.username);
  if (hit && hit.etag === etag) return hit;
  const png = await renderShareOgPng(input);
  if (ogCache.size > 80) {
    const first = ogCache.keys().next().value;
    if (first) ogCache.delete(first);
  }
  const entry = { etag, png };
  ogCache.set(input.username, entry);
  return entry;
}
