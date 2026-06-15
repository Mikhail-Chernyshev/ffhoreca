import { apiBaseUrl, apiFetch } from './apiBase';
import { authHeaders } from './apiAuth';

export type ReportReason =
  | 'csam'
  | 'sexual'
  | 'violence'
  | 'illegal'
  | 'spam'
  | 'other';

export type PlaceReportPayload = {
  placeId: string;
  placeName: string;
  ownerUsername: string;
  reason: ReportReason;
  message?: string;
  email: string;
  name?: string;
};

export async function submitPlaceReport(
  payload: PlaceReportPayload,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = apiBaseUrl();
  if (!base) {
    return { ok: false, message: 'API не настроен' };
  }
  try {
    const res = await apiFetch(`${base}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { ok: false, message: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
