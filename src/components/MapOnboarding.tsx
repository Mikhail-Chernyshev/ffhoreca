import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Catalog, TravelRoute } from '../data/types';
import { useT } from '../i18n/LocaleContext';
import { isHintSeen, markHintSeen } from '../lib/onboardingStore';
import type { useMapOnboarding } from '../hooks/useMapOnboarding';
import { OnboardingHelpControls } from './OnboardingHelpControls';

export type MapOnboardingMode = 'showcase' | 'ownMap' | 'sharedMap';

interface Props {
  mode: MapOnboardingMode;
  canEdit: boolean;
  catalog: Catalog;
  routes: TravelRoute[];
  isLoggedIn: boolean;
  username?: string | null;
  onAddCity: () => void;
  onStartTrip?: () => void;
  onAddPlace?: () => void;
  onboarding: ReturnType<typeof useMapOnboarding>;
  /** Рендерится в шапке; если false — кнопки не показываются здесь */
  hideHelpControls?: boolean;
  /** Не показывать карточку «первый совет», пока открыта открытка / мастер */
  hideFirstTip?: boolean;
  firstTipCity?: string | null;
}

export function MapOnboarding({
  mode,
  canEdit,
  catalog,
  routes: _routes,
  isLoggedIn,
  username,
  onAddCity,
  onStartTrip,
  onAddPlace,
  onboarding,
  hideHelpControls = false,
  hideFirstTip = false,
  firstTipCity = null,
}: Props) {
  const t = useT();
  const [tipDismissed, setTipDismissed] = useState(() => isHintSeen('firstTip'));
  const {
    skipped,
    tourOpen,
    setTourOpen,
    checklistCollapsed,
    bannerDismissed,
    dismissCallout,
    dismissBanner,
    dismissChecklist,
    skipAll,
    calloutMessageKey,
    hintsVersion,
  } = onboarding;

  const enabled = mode !== 'sharedMap';

  const showEmpty =
    enabled &&
    mode === 'ownMap' &&
    canEdit &&
    catalog.cities.length === 0 &&
    catalog.places.length === 0;

  const showBanner =
    enabled &&
    !skipped &&
    mode === 'showcase' &&
    !bannerDismissed &&
    !isHintSeen('showcaseBanner');

  const showFirstTip =
    enabled &&
    mode === 'ownMap' &&
    canEdit &&
    !hideFirstTip &&
    !showEmpty &&
    !tipDismissed &&
    catalog.cities.length > 0 &&
    catalog.places.length === 0 &&
    !!onAddPlace;

  const showChecklist =
    enabled &&
    !skipped &&
    mode === 'ownMap' &&
    canEdit &&
    !checklistCollapsed &&
    !isHintSeen('checklistDismissed') &&
    !showFirstTip;

  const checklist = {
    city: catalog.cities.length > 0,
    place: catalog.places.length > 0,
    // hintsVersion: re-read localStorage after notify('placeOpened')
    openPlace: hintsVersion >= 0 && isHintSeen('firstPlaceOpen'),
  };

  const checklistDone =
    checklist.city && checklist.place && checklist.openPlace;

  return (
    <>
      {!hideHelpControls ? (
        <div className="onboarding-toolbar">
          <OnboardingHelpControls
            onOpenTour={() => setTourOpen(true)}
            onSkip={skipAll}
            showSkip={enabled && mode === 'ownMap' && canEdit && !skipped}
          />
        </div>
      ) : null}

      {showBanner ? (
        <div className="onboarding-banner" role="status">
          <p className="onboarding-banner__text">
            {isLoggedIn && username
              ? t('onboarding.showcaseBannerUser', { username })
              : t('onboarding.showcaseBannerGuest')}
          </p>
          <button
            type="button"
            className="onboarding-banner__dismiss"
            onClick={dismissBanner}
          >
            {t('onboarding.dismiss')}
          </button>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="onboarding-empty">
          <h2 className="onboarding-empty__title">{t('onboarding.emptyTitle')}</h2>
          <p className="onboarding-empty__body">{t('onboarding.emptyBody')}</p>
          <div className="onboarding-empty__actions">
            {onStartTrip ? (
              <button type="button" className="onboarding-empty__cta" onClick={onStartTrip}>
                {t('onboarding.emptyAddTrip')}
              </button>
            ) : null}
            <button
              type="button"
              className={onStartTrip ? 'onboarding-empty__link' : 'onboarding-empty__cta'}
              onClick={onAddCity}
            >
              {t('onboarding.emptyAddCity')}
            </button>
            <button
              type="button"
              className="onboarding-empty__link"
              onClick={() => setTourOpen(true)}
            >
              {t('onboarding.helpButton')}
            </button>
          </div>
        </div>
      ) : null}

      {showFirstTip ? (
        <div className="onboarding-empty onboarding-empty--tip">
          <h2 className="onboarding-empty__title">{t('onboarding.firstTipTitle')}</h2>
          <p className="onboarding-empty__body">
            {firstTipCity
              ? t('onboarding.firstTipBodyCity', { city: firstTipCity })
              : t('onboarding.firstTipBody')}
          </p>
          <div className="onboarding-empty__actions">
            <button type="button" className="onboarding-empty__cta" onClick={onAddPlace}>
              {t('onboarding.firstTipCta')}
            </button>
            <button
              type="button"
              className="onboarding-empty__link"
              onClick={() => {
                markHintSeen('firstTip');
                setTipDismissed(true);
              }}
            >
              {t('onboarding.firstTipLater')}
            </button>
          </div>
        </div>
      ) : null}

      {showChecklist && !checklistDone ? (
        <div className="onboarding-checklist">
          <div className="onboarding-checklist__head">
            <span className="onboarding-checklist__title">{t('onboarding.checklistTitle')}</span>
            <button
              type="button"
              className="onboarding-checklist__dismiss"
              onClick={dismissChecklist}
              aria-label={t('onboarding.dismiss')}
            >
              ✕
            </button>
          </div>
          <ul className="onboarding-checklist__list">
            <ChecklistItem done={checklist.city} label={t('onboarding.checklistAddCity')} />
            <ChecklistItem done={checklist.place} label={t('onboarding.checklistAddPlace')} />
            <ChecklistItem done={checklist.openPlace} label={t('onboarding.checklistOpenPlace')} />
          </ul>
        </div>
      ) : null}

      {!skipped && calloutMessageKey ? (
        <div className="onboarding-callout" role="status">
          <p>{t(calloutMessageKey)}</p>
          <button
            type="button"
            className="onboarding-callout__btn"
            onClick={dismissCallout}
          >
            {t('onboarding.gotIt')}
          </button>
        </div>
      ) : null}

      {tourOpen ? (
        <OnboardingTourModal
          mode={mode}
          onClose={() => setTourOpen(false)}
          onStart={() => {
            setTourOpen(false);
            if (showEmpty) (onStartTrip ?? onAddCity)();
          }}
        />
      ) : null}
    </>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={`onboarding-checklist__item${done ? ' onboarding-checklist__item--done' : ''}`}>
      <span className="onboarding-checklist__mark" aria-hidden>{done ? '✓' : '○'}</span>
      {label}
    </li>
  );
}

function OnboardingTourModal({
  mode,
  onClose,
  onStart,
}: {
  mode: MapOnboardingMode;
  onClose: () => void;
  onStart: () => void;
}) {
  const t = useT();
  const [slide, setSlide] = useState(0);

  const slides =
    mode === 'showcase'
      ? [
          { title: t('onboarding.tourShowcaseSlide1Title'), body: t('onboarding.tourShowcaseSlide1Body') },
          { title: t('onboarding.tourShowcaseSlide2Title'), body: t('onboarding.tourShowcaseSlide2Body') },
          { title: t('onboarding.tourSlide1Title'), body: t('onboarding.tourSlide1Body') },
          { title: t('onboarding.tourSlide2Title'), body: t('onboarding.tourSlide2Body') },
          { title: t('onboarding.tourSlide5Title'), body: t('onboarding.tourSlide5Body') },
        ]
      : [
          { title: t('onboarding.tourSlide1Title'), body: t('onboarding.tourSlide1Body') },
          { title: t('onboarding.tourSlide2Title'), body: t('onboarding.tourSlide2Body') },
          { title: t('onboarding.tourSlide3Title'), body: t('onboarding.tourSlide3Body') },
          { title: t('onboarding.tourSlide4Title'), body: t('onboarding.tourSlide4Body') },
          { title: t('onboarding.tourSlide5Title'), body: t('onboarding.tourSlide5Body') },
        ];

  const last = slide >= slides.length - 1;

  return createPortal(
    <div
      className="onboarding-tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="onboarding-tour-panel">
        <div className="onboarding-tour-panel__header">
          <h2 id="onboarding-tour-title" className="onboarding-tour-panel__title">
            {t('onboarding.tourTitle')}
          </h2>
          <button type="button" className="onboarding-tour-panel__close" onClick={onClose} aria-label={t('modal.close')}>
            ✕
          </button>
        </div>
        <div className="onboarding-tour__body">
          <h3 className="onboarding-tour__slide-title">{slides[slide].title}</h3>
          <p className="onboarding-tour__slide-body">{slides[slide].body}</p>
          <div className="onboarding-tour__dots" aria-hidden>
            {slides.map((_, i) => (
              <span
                key={i}
                className={`onboarding-tour__dot${i === slide ? ' onboarding-tour__dot--active' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="onboarding-tour__footer">
          {slide > 0 ? (
            <button type="button" className="onboarding-tour__nav" onClick={() => setSlide((s) => s - 1)}>
              {t('onboarding.back')}
            </button>
          ) : (
            <span />
          )}
          {last ? (
            <button type="button" className="onboarding-tour__cta" onClick={onStart}>
              {t('onboarding.startBuilding')}
            </button>
          ) : (
            <button type="button" className="onboarding-tour__cta" onClick={() => setSlide((s) => s + 1)}>
              {t('onboarding.next')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
