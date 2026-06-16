import { useEffect } from 'react';

const DEFAULT = {
  title: 'Tips from trips — карта ваших путешествий',
  description:
    'Создайте личную карту путешествий: города, места, маршруты. Делитесь с друзьями или держите приватно.',
};

function upsertMeta(
  selector: string,
  attr: 'name' | 'property',
  content: string,
): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${selector}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, selector);
    document.head.appendChild(el);
  }
  el.content = content;
}

export type PageMeta = {
  title?: string;
  description?: string;
  url?: string;
};

export function applyPageMeta(meta: PageMeta): void {
  const title = meta.title ?? DEFAULT.title;
  const description = meta.description ?? DEFAULT.description;
  document.title = title;
  upsertMeta('description', 'name', description);
  upsertMeta('og:type', 'property', 'website');
  upsertMeta('og:title', 'property', title);
  upsertMeta('og:description', 'property', description);
  upsertMeta('twitter:card', 'name', 'summary');
  upsertMeta('twitter:title', 'name', title);
  upsertMeta('twitter:description', 'name', description);
  if (meta.url) {
    upsertMeta('og:url', 'property', meta.url);
  }
}

export function resetPageMeta(): void {
  applyPageMeta({});
}

export function usePageMeta(meta: PageMeta | null): void {
  useEffect(() => {
    if (meta) applyPageMeta(meta);
    else resetPageMeta();
    return () => resetPageMeta();
  }, [meta?.title, meta?.description, meta?.url]);
}
