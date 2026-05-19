import { useEffect, useMemo, useState } from 'react';

const FINAL_TEXT = 'Tips from Trips';
const WORD_CYCLE = ['PARIS', 'RIO', 'RUSSIA', 'DUBAI', 'BALI', 'TOKYO'] as const;

const WORD_ANCHORS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 24, y: 24 },
  { x: 82, y: 20 },
  { x: 52, y: 16 },
  { x: 14, y: 74 },
  { x: 86, y: 72 },
  { x: 50, y: 82 },
];

const CITY_TIMING = WORD_CYCLE.map((_, i) => ({
  startMs: 900 + i * 480,
  holdMs: 1_720 + (i % 3) * 140,
  floatPeriodMs: 2_100 + i * 320,
  letterStaggerMs: 52 + i * 10,
}));

export const SPLASH_ANIMATION_MS = 6_200;

const T_SCATTER_END = 820;
const T_PLAY_END = 4_750;
const T_GATHER_END = 5_450;

/** Только для opacity / фаз — не каждый кадр (убирает дёрганье) */
const CLOCK_TICK_MS = 150;

type Phase = 'scatter' | 'play' | 'gather' | 'final';

type LetterActor = {
  id: string;
  isExtra: boolean;
  finalIndex?: number;
  danceSeed: number;
  scatter: { x: number; y: number };
};

function buildActors(): LetterActor[] {
  const actors: LetterActor[] = [];
  FINAL_TEXT.split('').forEach((ch, i) => {
    const seed = i * 2.1 + ch.charCodeAt(0) * 0.008;
    actors.push({
      id: ch === ' ' ? `sp-${i}` : `f-${i}`,
      isExtra: false,
      finalIndex: i,
      danceSeed: seed,
      scatter: scatterPosition(seed),
    });
  });
  'QWXZENLYHCK'.split('').forEach((_c, i) => {
    const seed = i * 3.4 + 20;
    actors.push({
      id: `x-${i}`,
      isExtra: true,
      danceSeed: seed,
      scatter: scatterPosition(seed),
    });
  });
  return actors;
}

function layoutWordAt(
  word: string,
  anchorX: number,
  anchorY: number,
): Array<{ x: number; y: number; char: string }> {
  const spacing = 3.6;
  const width = Math.max(0, (word.length - 1) * spacing);
  const startX = anchorX - width / 2;
  return word.split('').map((char, i) => ({
    x: startX + i * spacing,
    y: anchorY,
    char,
  }));
}

/** Тонкая подстройка кернинга финальной строки (индекс = позиция в FINAL_TEXT) */
const FINAL_LETTER_DX: Partial<Record<number, number>> = {
  7: -0.48, // «o» в from — чуть ближе к «r»
};

function layoutFinal(): Map<number, { x: number; y: number; char: string }> {
  const spacing = 2.35;
  const width = (FINAL_TEXT.length - 1) * spacing;
  const startX = 50 - width / 2;
  const map = new Map<number, { x: number; y: number; char: string }>();
  FINAL_TEXT.split('').forEach((char, i) => {
    const dx = FINAL_LETTER_DX[i] ?? 0;
    map.set(i, { x: startX + i * spacing + dx, y: 50, char });
  });
  return map;
}

function scatterPosition(seed: number): { x: number; y: number } {
  const a = Math.sin(seed * 12.989) * 43758.5453;
  const b = Math.sin((seed + 1) * 78.233) * 12345.678;
  return {
    x: 10 + (a - Math.floor(a)) * 80,
    y: 16 + (b - Math.floor(b)) * 62,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function cityLifeOpacity(elapsed: number, startMs: number, holdMs: number): number {
  const t = elapsed - startMs;
  if (t < 0) return 0;
  const fadeIn = Math.min(1, t / 400);
  const fadeOutStart = holdMs - 400;
  if (t > fadeOutStart) {
    return fadeIn * Math.max(0, 1 - (t - fadeOutStart) / 400);
  }
  return fadeIn;
}

function useSplashClock(active: boolean) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    setNow(0);
    const id = window.setInterval(() => {
      setNow(performance.now() - t0);
    }, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  return now;
}

type Props = {
  onAnimationComplete?: () => void;
};

function CityDancer({
  word,
  anchor,
  timing,
  now,
  cityIndex,
}: {
  word: string;
  anchor: { x: number; y: number };
  timing: (typeof CITY_TIMING)[number];
  now: number;
  cityIndex: number;
}) {
  const layout = useMemo(
    () => layoutWordAt(word, anchor.x, anchor.y),
    [word, anchor.x, anchor.y],
  );

  const life = cityLifeOpacity(now, timing.startMs, timing.holdMs);
  if (life <= 0.01) return null;

  const wobbleClass = `loading-splash__letter--city-wobble-${cityIndex % 4}`;

  return (
    <>
      {layout.map((pos, i) => {
        const letterLife = cityLifeOpacity(
          now - i * timing.letterStaggerMs,
          timing.startMs,
          timing.holdMs,
        );
        const opacity = letterLife * life;
        if (opacity <= 0.01) return null;

        return (
          <span
            key={`${word}-${i}`}
            className={`loading-splash__letter loading-splash__letter--city ${wobbleClass}`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              opacity,
              animationDuration: `${timing.floatPeriodMs}ms`,
              animationDelay: `${i * 0.08}s`,
            }}
            aria-hidden
          >
            {pos.char}
          </span>
        );
      })}
    </>
  );
}

export function LoadingLetterSplash({ onAnimationComplete }: Props) {
  const actors = useMemo(() => buildActors(), []);
  const finalLayout = useMemo(() => layoutFinal(), []);

  const [phase, setPhase] = useState<Phase>('scatter');
  const clockActive = phase !== 'final';
  const now = useSplashClock(clockActive);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('play'), T_SCATTER_END));
    timers.push(setTimeout(() => setPhase('gather'), T_PLAY_END));
    timers.push(setTimeout(() => setPhase('final'), T_GATHER_END));
    timers.push(
      setTimeout(() => onAnimationComplete?.(), SPLASH_ANIMATION_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [onAnimationComplete]);

  const playBlend =
    phase === 'play'
      ? easeInOut(Math.min(1, Math.max(0, (now - T_SCATTER_END) / 480)))
      : 0;

  const renderActor = (actor: LetterActor) => {
    const { scatter } = actor;
    let x = scatter.x;
    let y = scatter.y;
    let opacity = 1;
    let dance = phase === 'scatter' || phase === 'play';

    let char: string;
    if (actor.isExtra) {
      char = 'QWXZENLYHCK'[Math.floor(actor.danceSeed) % 11] ?? 'Q';
    } else {
      char = FINAL_TEXT[actor.finalIndex ?? 0] ?? 'T';
      if (char === ' ') char = '·';
    }

    if (phase === 'scatter') {
      opacity = actor.isExtra ? 0.65 : 0.8;
    } else if (phase === 'play') {
      opacity = actor.isExtra
        ? 0.28 + playBlend * 0.32
        : Math.max(0.12, 0.5 - playBlend * 0.38);
    } else if (phase === 'gather') {
      dance = false;
      if (actor.isExtra) return null;
      if (actor.finalIndex !== undefined) {
        const target = finalLayout.get(actor.finalIndex);
        if (target) {
          x = target.x;
          y = target.y;
          char = target.char === ' ' ? '\u00a0' : target.char;
          opacity = 0.92;
        }
      }
    } else if (phase === 'final' && actor.finalIndex !== undefined) {
      dance = false;
      const target = finalLayout.get(actor.finalIndex);
      if (target) {
        x = target.x;
        y = target.y;
        char = target.char === ' ' ? '\u00a0' : target.char;
        opacity = 1;
      }
    } else if (actor.isExtra) {
      return null;
    }

    const floatVariant = Math.floor(actor.danceSeed) % 4;

    return (
      <span
        key={actor.id}
        className={[
          'loading-splash__letter',
          dance ? `loading-splash__letter--drift loading-splash__letter--drift-${floatVariant}` : '',
          phase === 'gather' ? 'loading-splash__letter--gather' : '',
          phase === 'final' ? 'loading-splash__letter--final' : '',
          actor.isExtra ? 'loading-splash__letter--extra' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          left: `${x}%`,
          top: `${y}%`,
          opacity,
          animationDuration: `${1.9 + (actor.danceSeed % 5) * 0.38}s`,
          animationDelay: `${(actor.danceSeed % 9) * 0.1}s`,
        }}
        aria-hidden
      >
        {char}
      </span>
    );
  };

  return (
    <div className="loading-splash" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-splash__backdrop" aria-hidden />
      <div className="loading-splash__stage">
        {actors.map(renderActor)}
        {phase === 'play' &&
          WORD_CYCLE.map((word, i) => (
            <CityDancer
              key={word}
              word={word}
              anchor={WORD_ANCHORS[i] ?? { x: 50, y: 50 }}
              timing={CITY_TIMING[i]!}
              now={now}
              cityIndex={i}
            />
          ))}
        <p
          className={`loading-splash__tagline${phase === 'final' ? ' loading-splash__tagline--visible' : ''}`}
        >
          Tips from Trips
        </p>
      </div>
    </div>
  );
}
