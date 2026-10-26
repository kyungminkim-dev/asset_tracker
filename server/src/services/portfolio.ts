import type { Db } from '../db.js';
import { toKstDate } from '../time.js';
import { listConnections } from './connections.js';

export const RANGES = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365, ALL: null } as const;
export type Range = keyof typeof RANGES;

interface SnapshotRow {
  date: string;
  total_value_krw: number;
  total_cost_krw: number;
  cash_krw: number;
  fx: string;
}

/** 기간 시작 시점의 기준 스냅샷: 시작일 이전 가장 최근 것, 없으면 가장 오래된 것 */
function baseline(db: Db, range: Range): SnapshotRow | undefined {
  const days = RANGES[range];
  if (days !== null) {
    const start = toKstDate(new Date(Date.now() - days * 86_400_000));
    const row = db.prepare('SELECT * FROM snapshots WHERE date <= ? ORDER BY date DESC LIMIT 1').get(start);
    if (row) return row as unknown as SnapshotRow;
  }
  return db.prepare('SELECT * FROM snapshots ORDER BY date ASC LIMIT 1').get() as unknown as SnapshotRow | undefined;
}

export function history(db: Db, range: Range) {
  const base = baseline(db, range);
  if (!base) return { range, points: [] };
  const rows = db
    .prepare('SELECT date, total_value_krw, total_cost_krw, cash_krw FROM snapshots WHERE date >= ? ORDER BY date')
    .all(base.date) as unknown as SnapshotRow[];
  return {
    range,
    points: rows.map((r) => ({ date: r.date, value: r.total_value_krw, cost: r.total_cost_krw + r.cash_krw })),
  };
}

export function summary(db: Db, range: Range) {
  const latest = db.prepare('SELECT * FROM snapshots ORDER BY date DESC LIMIT 1').get() as unknown as SnapshotRow | undefined;
  if (!latest) return null;
  const base = baseline(db, range)!;

  const positions = db.prepare('SELECT * FROM snapshot_positions WHERE date = ?').all(latest.date) as any[];
  const cash = db.prepare('SELECT * FROM snapshot_cash WHERE date = ?').all(latest.date) as any[];
  const basePrices = new Map(
    (db.prepare('SELECT market, symbol, current_price FROM snapshot_positions WHERE date = ?').all(base.date) as any[]).map(
      (r) => [`${r.market}:${r.symbol}`, r.current_price as number],
    ),
  );
  const labels = new Map(listConnections(db).map((c) => [c.id, c.label]));

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
    baselineDate: base.date,
    fx: JSON.parse(latest.fx) as Record<string, number>,
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
