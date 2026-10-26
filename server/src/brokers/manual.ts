import type { BrokerDefinition, Market } from './types.js';

/**
 * API 가 없거나 아직 연동하지 않은 증권사용.
 * 앱에서 보유 종목을 직접 입력하면 manual_positions 테이블에서 읽어 스냅샷에 포함한다.
 */
export const manual: BrokerDefinition = {
  id: 'manual',
  name: '직접 입력',
  kind: 'manual',
  description: 'API 를 제공하지 않는 증권사의 보유 종목을 직접 입력합니다. (예: 삼성증권, 미래에셋)',
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
