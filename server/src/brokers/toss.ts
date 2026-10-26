import { sleep } from '../time.js';
import type { AccountSnapshot, BrokerDefinition, Market, Position } from './types.js';
import { BrokerApiError } from './types.js';
import { cachedToken, num, requestJson } from './util.js';

/**
 * 토스증권 Open API (2026-08 정식 오픈)
 * - 키 발급: 토스증권 WTS > 설정 > Open API 에서 client_id / client_secret 발급, 허용 IP 등록
 * - 인증: OAuth2 client_credentials
 * - 계좌 지정: X-Tossinvest-Account 헤더 (계좌 목록의 accountSeq)
 * - 호출 한도: ACCOUNT 초당 1회, ASSET 초당 5회
 *
 * 응답은 { result: ... } 로 감싸져 오고 holdings 는 요약 + items[] 형태라는 보고가 있어
 * 파싱을 느슨하게 했다. 실제 키로 응답을 확인한 뒤 필드명을 맞춰 주세요.
 */

const ID = 'toss';
const BASE = 'https://openapi.tossinvest.com';

const unwrap = (body: any) => body?.result ?? body?.data ?? body;
const list = (value: any): any[] =>
  Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.accounts) ? value.accounts : [];

function toMarket(country: unknown): Market {
  const c = String(country ?? '').toUpperCase();
  if (c === 'KR' || c === 'KOR') return 'KR';
  if (c === 'US' || c === 'USA') return 'US';
  if (c === 'JP' || c === 'HK' || c === 'CN' || c === 'VN') return c;
  return 'OTHER';
}

export const toss: BrokerDefinition = {
  id: ID,
  name: '토스증권',
  kind: 'api',
  description: '토스증권 WTS > 설정 > Open API 에서 키를 발급받고, 이 서버의 공인 IP 를 허용 IP 로 등록하세요.',
  credentialFields: [
    { key: 'clientId', label: 'Client ID', secret: true },
    { key: 'clientSecret', label: 'Client Secret', secret: true },
  ],

  create(credentials, { db }) {
    const { clientId = '', clientSecret = '' } = credentials;

    const token = () =>
      cachedToken(db, `toss:token:${clientId}`, async () => {
        const { body } = await requestJson(ID, `${BASE}/oauth2/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
        });
        const data = unwrap(body);
        if (!data?.access_token) throw new BrokerApiError(ID, '토큰 발급 실패');
        return { token: data.access_token, expiresInSec: num(data.expires_in) || 3600 };
      });

    const get = async (path: string, accountSeq?: string) => {
      const headers: Record<string, string> = { authorization: `Bearer ${await token()}` };
      if (accountSeq) headers['X-Tossinvest-Account'] = accountSeq;
      const { body } = await requestJson(ID, `${BASE}${path}`, { headers });
      return unwrap(body);
    };

    const toPosition = (item: any): Position => {
      const quantity = num(item.quantity);
      const avgPrice = num(item.averagePurchasePrice);
      const currentPrice = num(item.lastPrice ?? item.currentPrice);
      const mv = item.marketValue;
      return {
        symbol: String(item.symbol ?? item.code),
        name: String(item.name ?? item.symbol),
        market: toMarket(item.marketCountry ?? item.market),
        currency: String(item.currency ?? 'KRW').toUpperCase(),
        quantity,
        avgPrice,
        currentPrice,
        marketValue: num(mv?.amount ?? mv) || currentPrice * quantity,
        costBasis: num(mv?.purchaseAmount ?? item.purchaseAmount) || avgPrice * quantity,
      };
    };

    return {
      async fetchAccounts(): Promise<AccountSnapshot[]> {
        const accounts = list(await get('/api/v1/accounts'));
        if (accounts.length === 0) throw new BrokerApiError(ID, '조회된 계좌가 없습니다.');
        const result: AccountSnapshot[] = [];
        for (const acc of accounts) {
          await sleep(1100); // ACCOUNT 그룹 초당 1회 제한
          const seq = String(acc.accountSeq);
          const holdings = await get('/api/v1/holdings', seq);
          result.push({
            accountId: String(acc.accountNo ?? seq),
            accountName: `토스 ${acc.accountType ?? ''} ${acc.accountNo ?? seq}`.replace(/\s+/g, ' ').trim(),
            positions: list(holdings).map(toPosition).filter((p) => p.quantity > 0),
            // TODO: 예수금 엔드포인트 확인 후 추가
            cash: [],
          });
        }
        return result;
      },
    };
  },
};
