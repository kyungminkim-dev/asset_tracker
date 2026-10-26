import type { BrokerDefinition, Market } from './types.js';

/**
 * API 가 없거나 아직 연동하지 않은 증권사용 정의를 만든다.
 * 앱에서 보유 종목을 직접 입력하면 manual_positions 테이블에서 읽어 스냅샷에 포함한다.
 * 나중에 그 증권사 API 를 연동하면 같은 id 로 api 정의를 만들어 catalog.ts 에서 빼면 된다.
 */
export function manualBroker(id: string, name: string, description?: string): BrokerDefinition {
  return {
    id,
    name,
    kind: 'manual',
    description: description ?? 'API 를 지원하지 않아 보유 종목을 직접 입력해요.',
    credentialFields: [],

    create(_credentials, { connectionId, db }) {
      return {
        async fetchAccounts() {
          const rows = db
            .prepare('SELECT * FROM manual_positions WHERE connection_id = ? ORDER BY symbol')
            .all(connectionId) as any[];
          return [
            {
              accountId: 'manual',
              positions: rows.map((r) => ({
                symbol: r.symbol,
                name: r.name,
                market: r.market as Market,
                currency: r.currency,
                quantity: r.quantity,
                avgPrice: r.avg_price,
                currentPrice: r.current_price,
                marketValue: r.current_price * r.quantity,
                costBasis: r.avg_price * r.quantity,
              })),
              cash: [],
            },
          ];
        },
      };
    },
  };
}

/** 목록에 없는 증권사 */
export const manual = manualBroker('manual', '기타 증권사', '목록에 없는 증권사의 보유 종목을 직접 입력해요.');
