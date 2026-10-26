import type { Db } from '../db.js';

/** 통화별 1단위당 원화. KRW 는 항상 1 */
export type FxRates = Record<string, number>;

/**
 * Frankfurter(ECB 기준환율)에서 환율을 가져온다. 지원하지 않는 통화나 조회 실패 시
 * 가장 최근 스냅샷의 환율로 대체한다.
 */
export async function getFxRates(db: Db, currencies: Iterable<string>): Promise<FxRates> {
  const wanted = [...new Set(currencies)].filter((c) => c !== 'KRW');
  const rates: FxRates = { KRW: 1 };
  if (wanted.length === 0) return rates;

  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=KRW&symbols=${wanted.join(',')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const body = (await res.json()) as { rates: Record<string, number> };
      for (const [cur, perKrw] of Object.entries(body.rates)) if (perKrw > 0) rates[cur] = 1 / perKrw;
    }
  } catch {
    // 아래에서 이전 환율로 대체
  }

  const missing = wanted.filter((c) => !rates[c]);
  if (missing.length > 0) {
    const last = db.prepare('SELECT fx FROM snapshots ORDER BY date DESC LIMIT 1').get() as { fx: string } | undefined;
    const prev: FxRates = last ? JSON.parse(last.fx) : {};
    for (const c of missing) {
      if (!prev[c]) throw new Error(`환율을 가져올 수 없습니다: ${c}`);
      rates[c] = prev[c];
    }
  }
  return rates;
}
