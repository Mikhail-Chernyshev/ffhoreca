import { useId } from 'react';

type Props = {
  /** icon — метка для favicon; lockup — название бренда в шапке */
  variant?: 'icon' | 'lockup';
  className?: string;
  /** Высота icon-варианта (квадрат) */
  size?: number;
  /** Высота lockup-варианта */
  height?: number;
};

function IconMark({
  className,
  size,
  gradientId,
}: {
  className?: string;
  size: number;
  gradientId: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path
        fill="#fff"
        d="M16 6.5c-3.45 0-6.25 2.68-6.25 5.98 0 4.52 6.25 11.02 6.25 11.02s6.25-6.5 6.25-11.02C22.25 9.18 19.45 6.5 16 6.5Zm0 8.08a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Z"
      />
      <path
        fill="none"
        stroke="#fbbf24"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M8.5 23.5c3-2.2 5.2-2.8 7.5-2.8s4.5.6 7.5 2.8"
      />
    </svg>
  );
}

export function BrandLogo({
  variant = 'lockup',
  className,
  size = 36,
  height = 40,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const badgeGradientId = `${uid}-badge`;
  const iconGradientId = `${uid}-icon`;

  if (variant === 'icon') {
    return <IconMark className={className} size={size} gradientId={iconGradientId} />;
  }

  const width = Math.round(height * (228 / 40));

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 228 40"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={badgeGradientId}
          x1="4"
          y1="4"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="10" fill={`url(#${badgeGradientId})`} />
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fill="#fff"
        fontFamily="var(--heading)"
        fontSize="13"
        fontWeight="700"
        letterSpacing="0.06em"
      >
        TFT
      </text>
      <path
        fill="none"
        stroke="#fbbf24"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M9 33.5c2.6-1.8 4.4-2.3 6.5-2.3s3.9.5 6.5 2.3"
      />

      <text
        className="brand-logo__name"
        x="50"
        y="26"
        fill="currentColor"
        fontFamily="var(--heading)"
        fontSize="17"
        fontWeight="600"
        letterSpacing="-0.03em"
      >
        Tips from trips
      </text>
    </svg>
  );
}
