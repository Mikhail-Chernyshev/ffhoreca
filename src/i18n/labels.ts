import type { PlaceCategory, UserRouteMode } from '../data/types';
import type { AppLocale } from './localeStore';
import { translate } from './messages';

export function categoryLabel(locale: AppLocale, cat: PlaceCategory): string {
  return translate(locale, `category.label.${cat}`);
}

export function routeModeLabel(locale: AppLocale, mode: UserRouteMode): string {
  return translate(locale, `routeMode.${mode}`);
}

export function routeModeAria(locale: AppLocale, mode: UserRouteMode): string {
  return translate(locale, `routeMode.aria.${mode}`);
}
