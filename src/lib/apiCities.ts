import type { City } from '../data/types';
import { apiBaseUrl } from './apiBase';
import { apiErrorMessage, apiMessage } from './apiMessages';
import { adminTokenForBody, adminAuthHeaders } from './adminToken';

export async function postCity(city: City): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };
  const token = adminTokenForBody();
  const extraHeaders = adminAuthHeaders();
  if (!token && !extraHeaders.Authorization) {
    return { ok: false, message: apiMessage('api.noAdminToken') };
  }

  const res = await fetch(`${base}/api/cities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ token, city }),
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.citySaved') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}

export async function deleteCityById(id: string): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };
  const token = adminTokenForBody();
  const extraHeaders = adminAuthHeaders();
  if (!token && !extraHeaders.Authorization) {
    return { ok: false, message: apiMessage('api.noAdminToken') };
  }

  const res = await fetch(`${base}/api/cities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': token, ...extraHeaders },
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.cityDeleted') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}
