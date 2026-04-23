import type { Catalog } from '../data/types';
import { apiBaseUrl } from './apiBase';

export async function fetchCatalogFromApi(): Promise<Catalog> {
  const base = apiBaseUrl();
  if (!base) throw new Error('VITE_API_BASE_URL не задан');
  const res = await fetch(`${base}/api/catalog`);
  if (!res.ok) {
    throw new Error(`catalog ${res.status}`);
  }
  return (await res.json()) as Catalog;
}
