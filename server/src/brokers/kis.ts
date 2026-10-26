import { sleep } from '../time.js';
import type { AccountSnapshot, BrokerDefinition, Market, Position } from './types.js';
import { BrokerApiError } from './types.js';
import { cachedToken, num, requestJson } from './util.js';

/**
 * 한국투자증권 KIS Developers (https://apiportal.koreainvestment.com)
 * - 국내주식 잔고: /uapi/domestic-stock/v1/trading/inquire-balance
 * - 해외주식 잔고: /uapi/overseas-stock/v1/trading/inquire-balance
 */

const ID = 'kis';
const BASE = {
  real: 'https://openapi.koreainvestment.com:9443',
  paper: 'https://openapivts.koreainvestment.com:29443',
};
// 실전: NASD = 미국 전체. 모의투자는 미국 거래소를 각각 조회해야 한다.
const OVERSEAS_EXCHANGES = {
  real: ['NASD', 'SEHK', 'SHAA', 'SZAA', 'TKSE', 'HASE', 'VNSE'],
  paper: ['NASD', 'NYSE', 'AMEX'],
};
const EXCHANGE_MARKET: Record<string, Market> = {
  NASD: 'US', NAS: 'US', NYSE: 'US', AMEX: 'US',
  SEHK: 'HK', SHAA: 'CN', SZAA: 'CN', TKSE: 'JP', HASE: 'VN', VNSE: 'VN',
};
const MARKET_CURRENCY: Partial<Record<Market, string>> = { US: 'USD', HK: 'HKD', CN: 'CNY', JP: 'JPY', VN: 'VND' };

export const kis: BrokerDefinition = {
  id: ID,
  name: '한국투자증권',
  kind: 'api',
  description: 'KIS Developers 에서 App Key / App Secret 을 발급받아 입력하세요.',
  credentialFields: [
    { key: 'appKey', label: 'App Key', secret: true },
    { key: 'appSecret', label: 'App Secret', secret: true },
    { key: 'accountNo', label: '계좌번호', placeholder: '12345678-01', help: '종합계좌번호 8자리-상품코드 2자리' },
    {
      key: 'env',
      label: '환경',
      options: [
        { value: 'real', label: '실전투자' },
        { value: 'paper', label: '모의투자' },
      ],
    },
  ],

  create(credentials, { db }) {
    const env = credentials.env === 'paper' ? 'paper' : 'real';
    const base = BASE[env];
    const { appKey = '', appSecret = '' } = credentials;
    const [cano, prdt] = (credentials.accountNo ?? '').replace(/\s/g, '').split('-');
    if (!cano || cano.length !== 8 || !prdt || prdt.length !== 2) {
      throw new BrokerApiError(ID, '계좌번호는 12345678-01 형식이어야 합니다.');
    }
    // 모의투자는 초당 호출 한도가 낮다
    const gap = env === 'paper' ? 600 : 100;

    const token = () =>
      cachedToken(db, `kis:token:${env}:${appKey}`, async () => {
        const { body } = await requestJson(ID, `${base}/oauth2/tokenP`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, appsecret: appSecret }),
        });
        if (!body?.access_token) throw new BrokerApiError(ID, '토큰 발급 실패');
        return { token: body.access_token, expiresInSec: num(body.expires_in) || 86_400 };
      });

    /** 연속조회(tr_cont)를 따라가며 output1 을 모두 모은다 */
    async function paged(path: string, trId: string, params: Record<string, string>, ctx: 'FK100' | 'FK200') {
      const nkKey = ctx === 'FK100' ? 'NK100' : 'NK200';
      const rows: any[] = [];
      let output2: any;
      let fk = '';
      let nk = '';
      let trCont = '';
      for (let page = 0; page < 20; page++) {
        const qs = new URLSearchParams({ ...params, [`CTX_AREA_${ctx}`]: fk, [`CTX_AREA_${nkKey}`]: nk });
        const { body, headers } = await requestJson(ID, `${base}${path}?${qs}`, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            authorization: `Bearer ${await token()}`,
            appkey: appKey,
            appsecret: appSecret,
            tr_id: trId,
            tr_cont: trCont,
            custtype: 'P',
          },
        });
        if (body?.rt_cd !== '0') throw new BrokerApiError(ID, `${body?.msg_cd ?? ''} ${body?.msg1 ?? '조회 실패'}`.trim());
        rows.push(...(body.output1 ?? []));
        output2 ??= body.output2;
        const more = headers.get('tr_cont');
        if (more !== 'M' && more !== 'F') break;
        fk = body[`ctx_area_${ctx.toLowerCase()}`] ?? '';
        nk = body[`ctx_area_${nkKey.toLowerCase()}`] ?? '';
        trCont = 'N';
        await sleep(gap);
      }
      return { rows, output2 };
    }

    async function domestic(): Promise<{ positions: Position[]; cash: number }> {
      const { rows, output2 } = await paged(
        '/uapi/domestic-stock/v1/trading/inquire-balance',
        env === 'paper' ? 'VTTC8434R' : 'TTTC8434R',
        {
          CANO: cano!, ACNT_PRDT_CD: prdt!, AFHR_FLPR_YN: 'N', OFL_YN: '', INQR_DVSN: '02',
          UNPR_DVSN: '01', FUND_STTL_ICLD_YN: 'N', FNCG_AMT_AUTO_RDPT_YN: 'N', PRCS_DVSN: '00',
        },
        'FK100',
      );
      const positions = rows
        .filter((r) => num(r.hldg_qty) > 0)
        .map((r) => ({
          symbol: r.pdno,
          name: r.prdt_name,
          market: 'KR' as const,
          currency: 'KRW',
          quantity: num(r.hldg_qty),
          avgPrice: num(r.pchs_avg_pric),
          currentPrice: num(r.prpr),
          marketValue: num(r.evlu_amt),
          costBasis: num(r.pchs_amt),
        }));
      const summary = Array.isArray(output2) ? output2[0] : output2;
      return { positions, cash: num(summary?.dnca_tot_amt) };
    }

    async function overseas(): Promise<Position[]> {
      const seen = new Map<string, Position>();
      for (const excg of OVERSEAS_EXCHANGES[env]) {
        const { rows } = await paged(
          '/uapi/overseas-stock/v1/trading/inquire-balance',
          env === 'paper' ? 'VTTS3012R' : 'TTTS3012R',
          { CANO: cano!, ACNT_PRDT_CD: prdt!, OVRS_EXCG_CD: excg, TR_CRCY_CD: MARKET_CURRENCY[EXCHANGE_MARKET[excg]!]! },
          'FK200',
        );
        for (const r of rows) {
          if (num(r.ovrs_cblc_qty) <= 0) continue;
          const exchange = r.ovrs_excg_cd || excg;
          const market = EXCHANGE_MARKET[exchange] ?? 'OTHER';
          seen.set(`${exchange}:${r.ovrs_pdno}`, {
            symbol: r.ovrs_pdno,
            name: r.ovrs_item_name,
            market,
            currency: r.tr_crcy_cd || MARKET_CURRENCY[market] || 'USD',
            quantity: num(r.ovrs_cblc_qty),
            avgPrice: num(r.pchs_avg_pric),
            currentPrice: num(r.now_pric2),
            marketValue: num(r.ovrs_stck_evlu_amt),
            costBasis: num(r.frcr_pchs_amt1),
          });
        }
        await sleep(gap);
      }
      return [...seen.values()];
    }

    return {
      async fetchAccounts(): Promise<AccountSnapshot[]> {
        const kr = await domestic();
        await sleep(gap);
        const foreign = await overseas();
        return [
          {
            accountId: `${cano}-${prdt}`,
            accountName: `한국투자 ${cano}-${prdt}`,
            positions: [...kr.positions, ...foreign],
            cash: [{ currency: 'KRW', amount: kr.cash }],
          },
        ];
      },
    };
  },
};
