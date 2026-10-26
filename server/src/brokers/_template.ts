/**
 * 새 증권사 추가용 템플릿. (registry.ts 에 등록하기 전까지는 앱에 노출되지 않는다)
 *
 * 1. 이 파일을 복사해 brokers/<증권사>.ts 로 만든다.
 * 2. id / name / credentialFields 를 채운다. 앱의 연결 폼은 이 필드로 자동 생성된다.
 * 3. fetchAccounts 에서 증권사 API 를 호출해 AccountSnapshot[] 으로 변환한다.
 *    - 금액은 종목의 거래 통화 그대로 넣는다. 원화 환산은 sync 서비스가 한다.
 *    - 토큰은 cachedToken(db, connectionId, ...) 으로 캐시한다. (발급 횟수 제한 대비, 연결 해제 시 함께 삭제)
 * 4. registry.ts 의 brokers 배열에 추가한다.
 */
import type { BrokerDefinition } from './types.js';
import { BrokerApiError } from './types.js';
import { cachedToken, num, requestJson } from './util.js';

const ID = 'example';
const BASE = 'https://api.example-securities.com';

export const example: BrokerDefinition = {
  id: ID,
  name: '예시증권',
  kind: 'api',
  credentialFields: [
    { key: 'apiKey', label: 'API Key', secret: true },
    { key: 'apiSecret', label: 'API Secret', secret: true },
    { key: 'accountNo', label: '계좌번호' },
  ],

  create(credentials, { db, connectionId }) {
    const token = () =>
      cachedToken(db, connectionId, async () => {
        const { body } = await requestJson(ID, `${BASE}/oauth/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key: credentials.apiKey, secret: credentials.apiSecret }),
        });
        if (!body?.access_token) throw new BrokerApiError(ID, '토큰 발급 실패');
        return { token: body.access_token, expiresInSec: num(body.expires_in) };
      });

    return {
      async fetchAccounts() {
        const { body } = await requestJson(ID, `${BASE}/accounts/${credentials.accountNo}/holdings`, {
          headers: { authorization: `Bearer ${await token()}` },
        });
        return [
          {
            accountId: credentials.accountNo ?? '',
            positions: (body.items ?? []).map((it: any) => ({
              symbol: it.code,
              name: it.name,
              market: 'KR' as const,
              currency: 'KRW',
              quantity: num(it.qty),
              avgPrice: num(it.avgPrice),
              currentPrice: num(it.price),
              marketValue: num(it.evalAmount),
              costBasis: num(it.buyAmount),
            })),
            cash: [{ currency: 'KRW', amount: num(body.cash) }],
          },
        ];
      },
    };
  },
};
