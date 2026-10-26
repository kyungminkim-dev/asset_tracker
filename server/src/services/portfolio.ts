import type { Db } from '../db.js';
import { toKstDate } from '../time.js';
import { listConnections } from './connections.js';

export const RANGES = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, ALL: null } as const;
export type Range = keyof typeof RANGES;

/** 조회 기간. start/end 는 YYYY-MM-DD(KST), null 이면 처음부터 / 오늘까지 */
export interface Period {
  range: Range | 'CUSTOM';
  start: string | null;
  end: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 쿼리(range=1M 또는 from=2026-01-01&to=2026-03-31)를 기간으로 바꾼다 */
export function parsePeriod(query: { range?: string; from?: string; to?: string }): Period {
  const { from, to } = query;
  if (from || to) {
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw new Error('날짜는 YYYY-MM-DD 형식이어야 합니다.');
    if (from && to && from > to) throw new Error('시작일이 종료일보다 늦습니다.');
    return { range: 'CUSTOM', start: from ?? null, end: to ?? null };
  }
  const range = query.range && query.range in RANGES ? (query.range as Range) : '1M';
  const days = RANGES[range];
  return { range, start: days === null ? null : toKstDate(new Date(Date.now() - days * 86_400_000)), end: null };
}

interface SnapshotRow {
  date: string;
  total_value_krw: number;
  total_cost_krw: number;
  cash_krw: number;
  fx: string;
}

/** 스냅샷의 USD 환율. 예전 스냅샷에 없으면 가장 최근에 알려진 환율로 대신한다 (환율은 사용자와 무관) */
function usdRate(db: Db, fxJson: string): number | null {
  const usd = (JSON.parse(fxJson) as Record<string, number>).USD;
  if (usd) return usd;
  const row = db
    .prepare("SELECT json_extract(fx, '$.USD') AS usd FROM snapshots WHERE json_extract(fx, '$.USD') IS NOT NULL ORDER BY date DESC LIMIT 1")
    .get() as { usd: number } | undefined;
  return row?.usd ?? null;
}

/** 기간 끝 시점 스냅샷: 종료일 이전 가장 최근 것 */
function endSnapshot(db: Db, userId: string, period: Period): SnapshotRow | undefined {
  return db
    .prepare('SELECT * FROM snapshots WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 1')
    .get(userId, period.end ?? '9999-12-31') as unknown as SnapshotRow | undefined;
}

/** 기간 시작 시점의 기준 스냅샷: 시작일 이전 가장 최근 것, 없으면 기간 안의 가장 오래된 것 */
function baseline(db: Db, userId: string, period: Period): SnapshotRow | undefined {
  if (period.start) {
    const row = db
      .prepare('SELECT * FROM snapshots WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 1')
      .get(userId, period.start);
    if (row) return row as unknown as SnapshotRow;
  }
  return db
    .prepare('SELECT * FROM snapshots WHERE user_id = ? AND date <= ? ORDER BY date ASC LIMIT 1')
    .get(userId, period.end ?? '9999-12-31') as unknown as SnapshotRow | undefined;
}

export function history(db: Db, userId: string, period: Period) {
  const base = baseline(db, userId, period);
  if (!base) return { range: period.range, points: [] };
  const rows = db
    .prepare(
      'SELECT date, total_value_krw, total_cost_krw, cash_krw, fx FROM snapshots WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date',
    )
    .all(userId, base.date, period.end ?? '9999-12-31') as unknown as SnapshotRow[];
  return {
    range: period.range,
    // usdKrw: 그날 환율. 앱이 달러로 보여줄 때 날짜별로 환산한다
    points: rows.map((r) => ({
      date: r.date,
      value: r.total_value_krw,
      cost: r.total_cost_krw + r.cash_krw,
      usdKrw: usdRate(db, r.fx),
    })),
  };
}

export function summary(db: Db, userId: string, period: Period) {
  const latest = endSnapshot(db, userId, period);
  if (!latest) return null;
  const base = baseline(db, userId, period)!;
  const range = period.range;

  const positions = db.prepare('SELECT * FROM snapshot_positions WHERE user_id = ? AND date = ?').all(userId, latest.date) as any[];
  const cash = db.prepare('SELECT * FROM snapshot_cash WHERE user_id = ? AND date = ?').all(userId, latest.date) as any[];
  const basePrices = new Map(
    (db.prepare('SELECT market, symbol, current_price FROM snapshot_positions WHERE user_id = ? AND date = ?').all(userId, base.date) as any[]).map(
      (r) => [`${r.market}:${r.symbol}`, r.current_price as number],
    ),
  );
  const labels = new Map(listConnections(db, userId).map((c) => [c.id, c.label]));

  // 같은 종목을 여러 증권사에서 갖고 있으면 하나로 합친다
  const holdings = new Map<string, any>();
  for (const p of positions) {
    const key = `${p.market}:${p.symbol}`;
    const h = holdings.get(key) ?? {
      symbol: p.symbol, name: p.name, market: p.market, currency: p.currency,
      quantity: 0, costNative: 0, currentPrice: p.current_price,
      valueKrw: 0, costKrw: 0, brokers: new Set<string>(), stale: false,
    };
    h.quantity += p.quantity;
    h.costNative += p.cost_basis;
    h.valueKrw += p.market_value_krw;
    h.costKrw += p.cost_basis_krw;
    h.brokers.add(labels.get(p.connection_id) ?? '삭제된 연결');
    h.stale ||= !!p.stale;
    holdings.set(key, h);
  }

  const stockValue = positions.reduce((s, p) => s + p.market_value_krw, 0);
  const totalValue = latest.total_value_krw;
  const totalCost = latest.total_cost_krw;

  const groupSum = (rows: any[], keyOf: (r: any) => string, valueOf: (r: any) => number) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + valueOf(r));
    return [...m].map(([key, value]) => ({ key, value, weight: totalValue ? value / totalValue : 0 })).sort((a, b) => b.value - a.value);
  };

  return {
    asOf: latest.date,
    range,
    period: { start: period.start, end: period.end },
    baselineDate: base.date,
    fx: JSON.parse(latest.fx) as Record<string, number>,
    usdKrw: usdRate(db, latest.fx),
    totalValue,
    stockValue,
    cash: latest.cash_krw,
    totalCost,
    profit: stockValue - totalCost,
    profitRate: totalCost ? (stockValue - totalCost) / totalCost : 0,
    change: {
      amount: totalValue - base.total_value_krw,
      rate: base.total_value_krw ? (totalValue - base.total_value_krw) / base.total_value_krw : 0,
    },
    byBroker: groupSum(
      [...positions.map((p) => ({ id: p.connection_id, v: p.market_value_krw })), ...cash.map((c) => ({ id: c.connection_id, v: c.amount_krw }))],
      (r) => labels.get(r.id) ?? '삭제된 연결',
      (r) => r.v,
    ),
    byMarket: groupSum(
      [...positions.map((p) => ({ k: p.market, v: p.market_value_krw })), { k: 'CASH', v: latest.cash_krw }],
      (r) => r.k,
      (r) => r.v,
    ).filter((g) => g.value > 0),
    holdings: [...holdings.values()]
      .map((h) => {
        const basePrice = basePrices.get(`${h.market}:${h.symbol}`);
        return {
          symbol: h.symbol,
          name: h.name,
          market: h.market,
          currency: h.currency,
          quantity: h.quantity,
          avgPrice: h.quantity ? h.costNative / h.quantity : 0,
          currentPrice: h.currentPrice,
          valueKrw: h.valueKrw,
          costKrw: h.costKrw,
          profitKrw: h.valueKrw - h.costKrw,
          profitRate: h.costKrw ? (h.valueKrw - h.costKrw) / h.costKrw : 0,
          weight: totalValue ? h.valueKrw / totalValue : 0,
          // 기간 등락률은 수량 변화와 무관하게 가격 기준으로 계산
          periodChangeRate: basePrice ? h.currentPrice / basePrice - 1 : null,
          brokers: [...h.brokers],
          stale: h.stale,
        };
      })
      .sort((a, b) => b.valueKrw - a.valueKrw),
  };
}
