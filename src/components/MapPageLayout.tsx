import type { ReactNode } from 'react';
import { useT } from '../i18n/LocaleContext';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';

type Props = {
  className?: string;
  splash?: ReactNode;
  splashActive?: boolean;
  headerLeftBelow?: ReactNode;
  headerRight: ReactNode;
  notices?: ReactNode;
  tools?: ReactNode;
  map: ReactNode;
  children?: ReactNode;
};

export function MapPageLayout({
  className,
  splash,
  splashActive,
  headerLeftBelow,
  headerRight,
  notices,
  tools,
  map,
  children,
}: Props) {
  const t = useT();

  return (
    <div
      className={['map-page', splashActive ? 'map-page--splash' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {splash}
      <div className="map-stage">
        {map}
        <div
          className="map-chrome"
          {...(splashActive ? { 'aria-hidden': true as const } : {})}
        >
          <div className="map-chrome__top">
            <AppHeader
              tagline={t('app.tagline')}
              right={headerRight}
              leftBelow={headerLeftBelow}
            />
          </div>
          {tools ? <div className="map-chrome__tools">{tools}</div> : null}
          <div className="map-chrome__notices">{notices}</div>
          <div className="map-chrome__bottom">
            <AppFooter />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
