import { loadServerUrl, loadSession } from './settings';

export type Range = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
export const RANGES: Range[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

export interface CredentialField {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
}

export interface Broker {
  id: string;
  name: string;
  kind: 'api' | 'manual';
  description?: string;
  credentialFields: CredentialField[];
}

export interface Connection {
  id: string;
  brokerId: string;
  brokerName: string;
  kind: 'api' | 'manual';
  label: string;
  createdAt: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface Holding {
  symbol: string;
  name: string;
  market: string;
  currency: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  valueKrw: number;
  costKrw: number;
  profitKrw: number;
  profitRate: number;
  weight: number;
  periodChangeRate: number | null;
  brokers: string[];
  stale: boolean;
}

export interface Group {
  key: string;
  value: number;
  weight: number;
}

export interface Summary {
  asOf: string;
  range: Range;
  baselineDate: string;
  fx: Record<string, number>;
  totalValue: number;
  stockValue: number;
  cash: number;
  totalCost: number;
  profit: number;
  profitRate: number;
  change: { amount: number; rate: number };
  byBroker: Group[];
  byMarket: Group[];
  holdings: Holding[];
}

export interface HistoryPoint {
  date: string;
  value: number;
  cost: number;
}

export interface ManualPosition {
  id: string;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  quantity: number;
  avg_price: number;
  current_price: number;
}

export interface ManualPositionInput {
  symbol: string;
  name: string;
  market: string;
  currency: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
}

export interface SyncResult {
  date: string;
  totalValueKrw: number;
  connections: { id: string; label: string; ok: boolean; error?: string }[];
}

export interface User {
  id: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  providers: string[];
}

export interface AuthProvider {
  id: 'google' | 'kakao' | 'dev';
  name: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    /** 서버/로그인 오류 코드 (예: not_registered) */
    public code?: string,
  ) {
    super(message);
  }
}

// 세션이 만료되면 로그인 화면으로 보내기 위한 콜백 (AuthProvider 가 등록)
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const [url, session] = await Promise.all([loadServerUrl(), loadSession()]);
  if (!url) throw new ApiError('설정에서 서버 주소를 입력하세요.');
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        ...(session ? { authorization: `Bearer ${session}` } : {}),
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new ApiError(`서버에 연결할 수 없습니다: ${url}`);
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401 && path.startsWith('/api/')) {
    onUnauthorized?.();
    throw new ApiError('로그인이 만료되었습니다. 다시 로그인하세요.', 401);
  }
  if (!res.ok) throw new ApiError(body?.error ?? `요청 실패 (${res.status})`, res.status);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  authProviders: () => request<AuthProvider[]>('/auth/providers'),
  exchangeLoginCode: (code: string, verifier: string) =>
    request<{ token: string; user: User }>('/auth/exchange', json('POST', { code, verifier })),
  /** 브라우저 로그인이 끝났는지 확인. 아직이면 { pending: true } */
  pollLogin: (verifier: string) =>
    request<{ token: string; user: User } | { pending: true } | { error: string }>('/auth/poll', json('POST', { verifier })),
  me: () => request<User>('/api/me'),
  logout: () => request('/api/logout', { method: 'POST' }),
  deleteAccount: () => request('/api/me', { method: 'DELETE' }),
  brokers: () => request<Broker[]>('/api/brokers'),
  connections: () => request<Connection[]>('/api/connections'),
  createConnection: (brokerId: string, label: string, credentials: Record<string, string>) =>
    request<Connection>('/api/connections', json('POST', { brokerId, label, credentials })),
  deleteConnection: (id: string) => request('/api/connections/' + id, { method: 'DELETE' }),
  manualPositions: (id: string) => request<ManualPosition[]>(`/api/connections/${id}/manual-positions`),
  saveManualPosition: (id: string, input: ManualPositionInput, positionId?: string) =>
    request<{ id: string }>(`/api/connections/${id}/manual-positions${positionId ? '/' + positionId : ''}`, json('PUT', input)),
  deleteManualPosition: (id: string, positionId: string) =>
    request(`/api/connections/${id}/manual-positions/${positionId}`, { method: 'DELETE' }),
  sync: () => request<SyncResult>('/api/sync', { method: 'POST' }),
  summary: (range: Range) => request<Summary | null>(`/api/portfolio/summary?range=${range}`),
  history: (range: Range) => request<{ range: Range; points: HistoryPoint[] }>(`/api/portfolio/history?range=${range}`),
};
