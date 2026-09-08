import { apiBaseUrl, apiFetch } from './apiBase';
import { authHeaders, type AuthUser } from './apiAuth';

export type FollowStatus = 'none' | 'pending' | 'accepted' | 'self';

export type FollowPerson = Pick<AuthUser, 'id' | 'username' | 'name' | 'avatar'>;

export type FollowRequest = {
  follower: FollowPerson;
  created_at: number;
};

export type FollowingRow = {
  owner: FollowPerson;
  status: 'pending' | 'accepted';
  created_at: number;
};

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    /* ignore */
  }
  return text || `HTTP ${res.status}`;
}

export async function requestMapFollow(username: string): Promise<FollowStatus> {
  const res = await apiFetch(`${apiBaseUrl()}/api/users/${encodeURIComponent(username)}/follow`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { status?: FollowStatus };
  return data.status === 'accepted' ? 'accepted' : 'pending';
}

export async function fetchFollowRequests(): Promise<FollowRequest[]> {
  const res = await apiFetch(`${apiBaseUrl()}/api/user/follow-requests`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { requests?: FollowRequest[] };
  return Array.isArray(data.requests) ? data.requests : [];
}

export async function acceptFollowRequest(followerId: string): Promise<void> {
  const res = await apiFetch(
    `${apiBaseUrl()}/api/user/follow-requests/${encodeURIComponent(followerId)}/accept`,
    { method: 'POST', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function rejectFollowRequest(followerId: string): Promise<void> {
  const res = await apiFetch(
    `${apiBaseUrl()}/api/user/follow-requests/${encodeURIComponent(followerId)}/reject`,
    { method: 'POST', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function fetchFollowing(): Promise<FollowingRow[]> {
  const res = await apiFetch(`${apiBaseUrl()}/api/user/following`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { following?: FollowingRow[] };
  return Array.isArray(data.following) ? data.following : [];
}

export async function unfollowUser(ownerId: string): Promise<void> {
  const res = await apiFetch(
    `${apiBaseUrl()}/api/user/following/${encodeURIComponent(ownerId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function fetchFollowers(): Promise<FollowRequest[]> {
  const res = await apiFetch(`${apiBaseUrl()}/api/user/followers`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { followers?: FollowRequest[] };
  return Array.isArray(data.followers) ? data.followers : [];
}

export async function revokeFollower(followerId: string): Promise<void> {
  const res = await apiFetch(
    `${apiBaseUrl()}/api/user/followers/${encodeURIComponent(followerId)}`,
    { method: 'DELETE', headers: authHeaders() },
  );
  if (!res.ok) throw new Error(await readError(res));
}
