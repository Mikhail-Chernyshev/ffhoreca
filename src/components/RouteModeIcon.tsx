import type { UserRouteMode } from '../data/types';

type Props = {
  mode: UserRouteMode;
  size?: number;
};

export function RouteModeIcon({ mode, size = 22 }: Props) {
  switch (mode) {
    case 'train':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
          <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-2.78c.61-.55 1-1.34 1-2.22V9c0-2.5-2-4.5-8-4.5S4 6.5 4 9v7zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6 10h12v3H6v-3z" />
        </svg>
      );
    case 'bus':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
          <rect x="5.2" y="2.8" width="9.4" height="2.3" rx="0.6" />
          <path
            fillRule="evenodd"
            d="M4 5.4h12.2c.45 0 .86.2 1.14.54L20 8.1c.4.42.62 1 .62 1.58v5.2c0 .95-.77 1.72-1.72 1.72H4.1A1.72 1.72 0 0 1 2.38 14.88V7.12C2.38 6.17 3.15 5.4 4 5.4Zm1.25 2.15h2.85v3.45H5.25V7.55Zm3.6 0h2.85v3.45H8.85V7.55Zm3.6 0h2.45v3.45h-2.45V7.55Zm3.3.05 1.55-1.45h1.15v4.9h-2.7V7.6Z"
          />
          <circle cx="7.35" cy="18.05" r="2.05" />
          <circle cx="16.15" cy="18.05" r="2.05" />
        </svg>
      );
    case 'boat':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
          <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.06.78L3.95 19z" />
        </svg>
      );
    case 'car':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v7c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-7l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </svg>
      );
    case 'plane':
    default:
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      );
  }
}
