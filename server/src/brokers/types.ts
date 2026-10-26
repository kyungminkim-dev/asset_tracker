import type { Db } from '../db.js';

/**
 * 증권사 연동 플러그인 규격.
 *
 * 새 증권사를 추가하려면 BrokerDefinition 을 구현한 파일을 만들고
 * registry.ts 에 등록하면 된다. (brokers/_template.ts 참고)
 * 앱의 "증권사 연결" 화면은 credentialFields 를 보고 입력 폼을 자동으로 그린다.
 */

export type Market = 'KR' | 'US' | 'JP' | 'HK' | 'CN' | 'VN' | 'OTHER';

/** 하나의 보유 종목. 금액은 모두 해당 종목의 거래 통화 기준 */
export interface Position {
  symbol: string;
  name: string;
  market: Market;
  currency: string; // ISO 4217 (KRW, USD, ...)
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
}

export interface CashBalance {
  currency: string;
  amount: number;
}

/** 증권사 계좌 1개의 현재 상태 */
export interface AccountSnapshot {
  accountId: string;
  accountName?: string;
  positions: Position[];
  cash: CashBalance[];
}

export interface CredentialField {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[]; // 있으면 선택형
}

export interface BrokerContext {
  connectionId: string;
  db: Db;
}

export interface BrokerAdapter {
  /** 연결된 모든 계좌의 보유 종목과 예수금을 가져온다 */
  fetchAccounts(): Promise<AccountSnapshot[]>;
}

export interface BrokerDefinition {
  id: string;
  name: string;
  /** api: 증권사 API 자동 동기화 / manual: 사용자가 직접 입력 */
  kind: 'api' | 'manual';
  description?: string;
  credentialFields: CredentialField[];
  create(credentials: Record<string, string>, ctx: BrokerContext): BrokerAdapter;
}

export class BrokerApiError extends Error {
  constructor(
    public brokerId: string,
    message: string,
    public status?: number,
  ) {
    super(`[${brokerId}] ${message}`);
  }
}
