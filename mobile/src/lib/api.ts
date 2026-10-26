import { loadSettings } from './settings';

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

export class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, token } = await loadSettings();
  if (!url) throw new ApiError('설정에서 서버 주소를 입력하세요.');
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new ApiError(`서버에 연결할 수 없습니다: ${url}`);
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401) throw new ApiError('접근 토큰이 올바르지 않습니다. 설정을 확인하세요.');
  if (!res.ok) throw new ApiError(body?.error ?? `요청 실패 (${res.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
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
