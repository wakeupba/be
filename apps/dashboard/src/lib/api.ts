import type {
  CallHistoryDto,
  CallOutcome,
  FeatureCardDto,
  MeDto,
  UpcomingEventDto,
} from '@wakeupbabe/shared';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';

export class UnauthorizedError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  loginUrl: () => `${API}/auth/login`,
  me: () => request<MeDto>('/me'),
  updateSettings: (patch: Record<string, unknown>) =>
    request<{ ok: true }>('/me/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
  events: () => request<UpcomingEventDto[]>('/me/events'),
  calls: () => request<CallHistoryDto[]>('/me/calls'),
  callOutcome: (id: string) => request<{ outcome: CallOutcome }>(`/me/calls/${id}`),
  verifyCall: () => request<{ ok: true; callId: string }>('/me/verify-call', { method: 'POST' }),
  disconnectCalendar: () =>
    request<{ ok: true; cancelledCalls?: number }>('/me/calendar/disconnect', { method: 'POST' }),
  billingCheckout: (kind: 'upgrade' | 'topup') =>
    request<{ url: string }>('/me/billing/checkout', { method: 'POST', body: JSON.stringify({ kind }) }),
  billingPortal: () => request<{ url: string }>('/me/billing/portal', { method: 'POST' }),
  features: () => request<FeatureCardDto[]>('/features'),
  voteFeature: (key: string, note?: string) =>
    request<{ ok: true }>(`/features/${key}/vote`, { method: 'POST', body: JSON.stringify({ note }) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
};
