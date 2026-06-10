import type { ReactNode } from 'react';
import { LocaleToggle } from './LocaleToggle';

interface Props {
  center: ReactNode;
  right: ReactNode;
  leftBelow?: ReactNode;
}

export function AppHeader({ center, right, leftBelow }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <div className="app-header__left-stack">
          <LocaleToggle />
          {leftBelow}
        </div>
      </div>
      <div className="app-header__center">{center}</div>
      <div className="app-header__right">{right}</div>
    </header>
  );
}
