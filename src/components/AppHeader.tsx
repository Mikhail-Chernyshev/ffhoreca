import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { LocaleToggle } from './LocaleToggle';

interface Props {
  tagline: ReactNode;
  right: ReactNode;
  leftBelow?: ReactNode;
}

export function AppHeader({ tagline, right, leftBelow }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <div className="app-header__left-stack">
          <LocaleToggle />
          {leftBelow ? <div className="app-header__left-below">{leftBelow}</div> : null}
        </div>
      </div>
      <div className="app-header__center">
        <Link to="/" className="app-brand app-brand--lockup">
          <h1 className="sr-only">Tips from trips</h1>
          <BrandLogo variant="lockup" className="app-brand__lockup" height={40} />
          <p className="app-tagline">{tagline}</p>
        </Link>
      </div>
      <div className="app-header__right">{right}</div>
    </header>
  );
}
