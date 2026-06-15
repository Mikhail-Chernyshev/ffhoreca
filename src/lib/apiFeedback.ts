import { apiBaseUrl } from './apiBase';
import { authHeaders } from './apiAuth';

export type FeedbackPayload = {
  name?: string;
  email: string;
  message: string;
};

export async function submitFeedback(
  payload: FeedbackPayload,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = apiBaseUrl();
  if (!base) {
    return { ok: false, message: 'API не настроен' };
  }
  try {
    const res = await fetch(`${base}/api/feedback`, {
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
