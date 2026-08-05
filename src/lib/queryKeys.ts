/** Централизованные ключи кэша TanStack Query */
export const queryKeys = {
  authMe: ['auth', 'me'] as const,
  authUsage: ['auth', 'usage'] as const,
  favorites: ['favorites'] as const,
  userSearch: (q: string) => ['users', 'search', q] as const,
  showcaseCatalog: ['showcase', 'catalog'] as const,
  showcaseRoutes: ['showcase', 'routes'] as const,
};
