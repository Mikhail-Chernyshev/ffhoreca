import type { CSSProperties, ReactNode } from 'react';
import type { RewardId } from '../lib/rewards';

type Props = {
  id: RewardId;
  unlocked: boolean;
  comingSoon: boolean;
  current: number;
  target: number;
  soonLabel: string;
};

const SIZE = 96;
const CX = 48;
const CY = 48;
const WAX_PATH = scallopedCircle(CX, CY, 44.8, 22);
const RING_R = 33.5;
const RING_C = 2 * Math.PI * RING_R;

function scallopedCircle(cx: number, cy: number, r: number, waves: number): string {
  const steps = waves * 6;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI * 2 - Math.PI / 2;
    const rad = r + Math.cos(t * Math.PI * 2 * waves) * 1.55;
    parts.push(
      `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

function stampTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return (h % 13) - 6;
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <g
      className="reward-seal__glyph"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(36 34.5)"
    >
      {children}
    </g>
  );
}

const GLYPHS: Record<RewardId, ReactNode> = {
  firstBorder: (
    <Glyph>
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.4" />
      <path d="M8 8.2h8M8 11.4h5.5" />
      <circle cx="16.1" cy="15.6" r="2.1" />
    </Glyph>
  ),
  greatStart: (
    <Glyph>
      <path d="M4 16.5c2.2-2.4 4.1-3.6 8-3.6s5.8 1.2 8 3.6" />
      <path d="M12 5.2v4.2M8.2 6.6l1.6 1.6M15.8 6.6l-1.6 1.6" />
      <circle cx="12" cy="4.4" r="1.15" />
    </Glyph>
  ),
  fiveBorders: (
    <Glyph>
      <path d="M5 16V8.5M9 16V6.2M13 16V8.5M17 16V7.2" />
      <path d="M4.2 16.6h16" />
    </Glyph>
  ),
  worldWanderer: (
    <Glyph>
      <circle cx="12" cy="12" r="7.2" />
      <path d="M12 5.5v3.2L14.4 12 12 14.2v4.3" />
      <path d="M8.2 9.4h3.1L12 12l3.8.4" />
    </Glyph>
  ),
  globetrotter: (
    <Glyph>
      <circle cx="12" cy="12" r="7.3" />
      <ellipse cx="12" cy="12" rx="3.2" ry="7.3" />
      <path d="M5 12h14M7.2 8.1h9.6M7.2 15.9h9.6" />
    </Glyph>
  ),
  fiftyNations: (
    <Glyph>
      <circle cx="12" cy="12" r="7.3" />
      <path d="M12 4.7a7.3 7.3 0 0 0 0 14.6" />
      <path d="M5.2 12h6.8" />
    </Glyph>
  ),
  longHaul: (
    <Glyph>
      <path d="M4.4 15.2c2.8-6.4 6.2-9.4 7.6-9.4s4.8 3 7.6 9.4" />
      <circle cx="12" cy="16.4" r="1.2" />
    </Glyph>
  ),
  centuryClub: (
    <Glyph>
      <circle cx="12" cy="12" r="7.3" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  atlasAlmost: (
    <Glyph>
      <path d="M5 5.2v13.6c2.4-1.1 4.4-1.1 7 0V5.2C9.4 6.3 7.4 6.3 5 5.2Z" />
      <path d="M12 5.2v13.6c2.6-1.1 4.6-1.1 7 0V5.2c-2.4 1.1-4.4 1.1-7 0Z" />
    </Glyph>
  ),
  wholeWorld: (
    <Glyph>
      <circle cx="12" cy="11.2" r="6.4" />
      <ellipse cx="12" cy="11.2" rx="2.7" ry="6.4" />
      <path d="M6 11.2h12" />
      <path d="M5.2 19.2c2.3-1.6 4.4-2.1 6.8-2.1s4.5.5 6.8 2.1" />
    </Glyph>
  ),
  schengenExpert: (
    <Glyph>
      <circle cx="12" cy="12" r="7.2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={12 + Math.cos(a) * 4.15}
            cy={12 + Math.sin(a) * 4.15}
            r="0.72"
            fill="currentColor"
            stroke="none"
          />
        );
      })}
    </Glyph>
  ),
  twoContinents: (
    <Glyph>
      <path d="M5.2 8.4c1.8-2.4 4.6-2.6 6.2-.4 1.2 1.7.4 3.8-1.1 4.6-2.2 1.2-4.6.2-5.1-1.8-.3-1.2.2-2.4 0-2.4Z" />
      <path d="M13.4 12.2c1.6-1.8 4.2-1.6 5.6.5 1 1.6.2 3.6-1.4 4.3-2 .9-4.3-.4-4.6-2.4-.2-1.1.2-2 .4-2.4Z" />
    </Glyph>
  ),
  pangaea: (
    <Glyph>
      <path d="M7.2 6.4c2.4-1.8 6.6-1.6 8.8.6 2 2 .8 5.2-.6 6.8 1.4 1.2 1.8 3.2.2 4.6-2.2 1.8-6.2 1.6-8.4-.2-2.2-1.8-2.4-5.2-.8-7.2-1.2-1.4-1-3.2.8-4.6Z" />
    </Glyph>
  ),
  localExpert: (
    <Glyph>
      <path d="M4.8 16.8V11l3.2-3.4 3.1 3.4v6" />
      <path d="M11.1 16.8V9.6l3.3-3.6 3.4 3.6v7.2" />
      <path d="M7.2 16.8h10.4" />
    </Glyph>
  ),
  cityHopper: (
    <Glyph>
      <path d="M8 14.6c0-2.3 1.7-4.1 4-5.8 2.3 1.7 4 3.5 4 5.8a4 4 0 0 1-8 0Z" />
      <circle cx="12" cy="14.4" r="1.15" />
      <path d="M5.2 7.2c.8-1.2 1.8-2 3.1-2.8" />
      <path d="M18.8 7.2c-.8-1.2-1.8-2-3.1-2.8" />
    </Glyph>
  ),
  firstTip: (
    <Glyph>
      <path d="M12 4.6c3.3 0 5.9 2.5 5.9 5.6 0 4.2-5.9 10.2-5.9 10.2S6.1 14.4 6.1 10.2c0-3.1 2.6-5.6 5.9-5.6Z" />
      <circle cx="12" cy="10.1" r="1.7" />
    </Glyph>
  ),
  foodie: (
    <Glyph>
      <path d="M6.2 5.2v6.2c0 1.4.8 2.4 2 2.4s2-1 2-2.4V5.2" />
      <path d="M8.2 5.2v4.4" />
      <path d="M14.4 5.4v8.4" />
      <path d="M14.4 5.4c1.8 0 3.2 1.2 3.2 3.1S16.2 11.4 14.4 11.4" />
      <path d="M5.4 18.4h13.2" />
    </Glyph>
  ),
  nightOwl: (
    <Glyph>
      <path d="M7.4 16.6c2.2-2 4.1-2.6 4.6-2.6s2.4.6 4.6 2.6" />
      <path d="M9.6 8.2c0-1.7 1.1-3 2.4-3 1.2 0 1.8.8 1.8 1.9 0 2.4-3.4 2.8-3.4 5.1" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  innkeeper: (
    <Glyph>
      <path d="M4.6 14.4h14.8v3.4H4.6z" />
      <path d="M6.2 14.4V11c0-1.6 1.4-2.8 3.2-2.8h3.4c1.8 0 3.2 1.2 3.2 2.8v3.4" />
      <path d="M4.6 17.8v1.6M19.4 17.8v1.6" />
    </Glyph>
  ),
  photographer: (
    <Glyph>
      <rect x="4.2" y="8.2" width="15.6" height="10.2" rx="1.6" />
      <circle cx="12" cy="13.3" r="3.1" />
      <path d="M9.2 8.2 10.4 5.8h3.2L14.8 8.2" />
    </Glyph>
  ),
  storyteller: (
    <Glyph>
      <path d="M7.2 4.8h9.6v14.4H7.2z" />
      <path d="M9.4 8.4h5.2M9.4 11.4h5.2M9.4 14.4h3.4" />
    </Glyph>
  ),
  firstRoute: (
    <Glyph>
      <circle cx="6.2" cy="17.2" r="1.5" />
      <circle cx="17.8" cy="6.6" r="1.5" />
      <path d="M7.6 16.1c2.4-1 3.4-2.8 3.6-5.1.2-2.6 1.8-4.2 4.8-5" />
    </Glyph>
  ),
  frequentFlyer: (
    <Glyph>
      <path d="M4.4 14.2 12 11.4l8.2 2.6-8.2-7.2L10.6 4.6 9.4 7.2 4.6 9.2l3.4 1.4-3.6 3.6Z" />
    </Glyph>
  ),
  groupTourism: (
    <Glyph>
      <circle cx="8.2" cy="8.2" r="2.1" />
      <circle cx="15.8" cy="8.2" r="2.1" />
      <circle cx="12" cy="10.4" r="2.25" />
      <path d="M4.6 18.4c.4-2.8 2.1-4.2 3.8-4.2 1.2 0 2.1.6 2.8 1.6.7-1 1.7-1.7 3-1.7 1.8 0 3.4 1.4 3.8 4.3" />
    </Glyph>
  ),
  seaKing: (
    <Glyph>
      <path d="M5.2 13.4 12 8.6l6.8 4.8-1.4 3.2H6.6Z" />
      <path d="M8.6 8.8 12 5.2l3.4 3.6" />
      <path d="M4.4 19c1.6-1.1 2.8-1.1 4.2 0 1.4 1.1 2.6 1.1 4 0 1.4-1.1 2.6-1.1 4 0 1.4 1.1 2.6 1.1 3.4.4" />
    </Glyph>
  ),
};

export function RewardSeal({
  id,
  unlocked,
  comingSoon,
  current,
  target,
  soonLabel,
}: Props) {
  const ratio = target <= 0 ? 0 : Math.min(1, current / target);
  const offset = RING_C * (1 - (comingSoon ? 0 : unlocked ? 1 : ratio));
  const state = comingSoon ? 'soon' : unlocked ? 'on' : 'off';

  return (
    <span
      className={`reward-seal reward-seal--${state}`}
      style={{ '--seal-tilt': `${unlocked ? stampTilt(id) : 0}deg` } as CSSProperties}
      aria-hidden
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="reward-seal__svg">
        <path className="reward-seal__wax" d={WAX_PATH} />
        <circle className="reward-seal__disc" cx={CX} cy={CY} r="38.4" />
        <circle
          className="reward-seal__track"
          cx={CX}
          cy={CY}
          r={RING_R}
          fill="none"
        />
        <circle
          className="reward-seal__arc"
          cx={CX}
          cy={CY}
          r={RING_R}
          fill="none"
          strokeDasharray={RING_C.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
        {GLYPHS[id]}
        {unlocked ? (
          <path
            className="reward-seal__shine"
            d="M28 34c6-9 16-13 24-12"
            fill="none"
          />
        ) : null}
        {comingSoon ? (
          <g className="reward-seal__void" transform="rotate(-22 48 48)">
            <rect x="14" y="42" width="68" height="12.5" rx="1.4" />
            <text x="48" y="51.4" textAnchor="middle">
              {soonLabel}
            </text>
          </g>
        ) : null}
      </svg>
    </span>
  );
}
