import type { AccountSnapshot } from '../brokers/types.js';
import { transaction, type Db } from '../db.js';
import { toKstDate } from '../time.js';
import { adapterFor, listConnections } from './connections.js';
import { getFxRates } from './fx.js';

export interface SyncResult {
  date: string;
  totalValueKrw: number;
  connections: { id: string; label: string; ok: boolean; error?: string }[];
}

const running = new Map<string, Promise<SyncResult>>();

/** 같은 사용자의 동기화가 동시에 여러 번 호출돼도 한 번만 실행한다 */
export function syncUser(db: Db, userId: string): Promise<SyncResult> {
  let job = running.get(userId);
  if (!job) {
    job = doSync(db, userId).finally(() => running.delete(userId));
    running.set(userId, job);
  }
  return job;
}

/** 매일 스케줄러용: 증권사를 연결한 모든 사용자를 차례로 동기화 */
export async function syncEveryone(db: Db) {
  const users = db.prepare('SELECT DISTINCT user_id FROM connections').all() as { user_id: string }[];
  const results: { userId: string; ok: boolean; error?: string }[] = [];
  for (const { user_id } of users) {
    try {
      await syncUser(db, user_id);
      results.push({ userId: user_id, ok: true });
    } catch (err) {
      results.push({ userId: user_id, ok: false, error: (err as Error).message });
    }
  }
  return results;
}

/**
 * 사용자의 모든 연결된 증권사에서 잔고를 가져와 오늘(KST) 스냅샷을 만든다.
 * 하루에 여러 번 실행하면 그날 스냅샷을 덮어쓴다.
 * 특정 증권사가 실패하면 직전 스냅샷의 값을 이어붙여(stale) 그래프가 갑자기 꺼지지 않게 한다.
 */
async function doSync(db: Db, userId: string): Promise<SyncResult> {
  const connections = listConnections(db, userId);
  const date = toKstDate();
  const now = new Date().toISOString();

  if (connections.length === 0) throw new Error('연결된 증권사가 없습니다.');

  // 증권사별로 병렬 조회 (async 로 감싸 adapter 생성 중 에러도 개별 실패로 처리)
  const results = await Promise.allSettled(connections.map(async (c) => adapterFor(db, c).fetchAccounts()));

  const fresh = new Map<string, AccountSnapshot[]>();
  const failed = new Map<string, string>();
  results.forEach((r, i) => {
    const conn = connections[i]!;
    if (r.status === 'fulfilled') fresh.set(conn.id, r.value);
    else failed.set(conn.id, (r.reason as Error)?.message ?? String(r.reason));
  });

  // 전부 실패하면 기존 스냅샷을 건드리지 않는다
  if (fresh.size === 0) {
    const upd = db.prepare('UPDATE connections SET last_error = ? WHERE id = ?');
    for (const [id, error] of failed) upd.run(error, id);
    throw new Error(`모든 증권사 동기화 실패: ${[...failed.values()].join(' / ')}`);
  }

  // 실패한 연결은 가장 최근 스냅샷의 보유 내역을 가져온다
  const carried = new Map<string, { positions: any[]; cash: any[] }>();
  for (const id of failed.keys()) {
    const last = db
      .prepare('SELECT MAX(date) AS date FROM snapshot_positions WHERE connection_id = ?')
      .get(id) as { date: string | null };
    const lastCash = db
      .prepare('SELECT MAX(date) AS date FROM snapshot_cash WHERE connection_id = ?')
      .get(id) as { date: string | null };
    carried.set(id, {
      positions: last.date
        ? db.prepare('SELECT * FROM snapshot_positions WHERE connection_id = ? AND date = ?').all(id, last.date)
        : [],
      cash: lastCash.date
        ? db.prepare('SELECT * FROM snapshot_cash WHERE connection_id = ? AND date = ?').all(id, lastCash.date)
        : [],
    });
  }

  const currencies = new Set<string>();
  for (const accounts of fresh.values())
    for (const a of accounts) {
      a.positions.forEach((p) => currencies.add(p.currency));
      a.cash.forEach((c) => currencies.add(c.currency));
    }
  for (const c of carried.values()) {
    c.positions.forEach((p) => currencies.add(p.currency));
    c.cash.forEach((p) => currencies.add(p.currency));
  }
  const fx = await getFxRates(db, currencies);
  const krw = (amount: number, currency: string) => amount * (fx[currency] ?? 0);

  let totalValue = 0;
  let totalCost = 0;
  let totalCash = 0;

  transaction(db, () => {
    db.prepare('DELETE FROM snapshots WHERE user_id = ? AND date = ?').run(userId, date);
    db.prepare(
      'INSERT INTO snapshots (user_id, date, taken_at, fx, total_value_krw, total_cost_krw, cash_krw) VALUES (?, ?, ?, ?, 0, 0, 0)',
    ).run(userId, date, now, JSON.stringify(fx));
    const insPos = db.prepare(`
      INSERT INTO snapshot_positions (user_id, date, connection_id, account_id, symbol, name, market, currency, quantity,
        avg_price, current_price, market_value, cost_basis, market_value_krw, cost_basis_krw, stale)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insCash = db.prepare(
      'INSERT INTO snapshot_cash (user_id, date, connection_id, account_id, currency, amount, amount_krw, stale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );

    const addPosition = (connId: string, accountId: string, p: any, stale: number) => {
      const mv = krw(p.marketValue, p.currency);
      const cost = krw(p.costBasis, p.currency);
      totalValue += mv;
      totalCost += cost;
      insPos.run(userId, date, connId, accountId, p.symbol, p.name, p.market, p.currency, p.quantity, p.avgPrice,
        p.currentPrice, p.marketValue, p.costBasis, mv, cost, stale);
    };
    const addCash = (connId: string, accountId: string, currency: string, amount: number, stale: number) => {
      const value = krw(amount, currency);
      totalCash += value;
      insCash.run(userId, date, connId, accountId, currency, amount, value, stale);
    };

    for (const [connId, accounts] of fresh)
      for (const a of accounts) {
        a.positions.forEach((p) => addPosition(connId, a.accountId, p, 0));
        a.cash.forEach((c) => addCash(connId, a.accountId, c.currency, c.amount, 0));
      }
    for (const [connId, { positions, cash }] of carried) {
      for (const r of positions)
        addPosition(connId, r.account_id, {
          symbol: r.symbol, name: r.name, market: r.market, currency: r.currency, quantity: r.quantity,
          avgPrice: r.avg_price, currentPrice: r.current_price, marketValue: r.market_value, costBasis: r.cost_basis,
        }, 1);
      for (const r of cash) addCash(connId, r.account_id, r.currency, r.amount, 1);
    }

    db.prepare('UPDATE snapshots SET total_value_krw = ?, total_cost_krw = ?, cash_krw = ? WHERE user_id = ? AND date = ?').run(
      totalValue + totalCash,
      totalCost,
      totalCash,
      userId,
      date,
    );

    const ok = db.prepare('UPDATE connections SET last_synced_at = ?, last_error = NULL WHERE id = ?');
    const err = db.prepare('UPDATE connections SET last_error = ? WHERE id = ?');
    for (const id of fresh.keys()) ok.run(now, id);
    for (const [id, error] of failed) err.run(error, id);
  });

  return {
    date,
    totalValueKrw: totalValue + totalCash,
    connections: connections.map((c) => ({
      id: c.id,
      label: c.label,
      ok: fresh.has(c.id),
      ...(failed.has(c.id) ? { error: failed.get(c.id) } : {}),
    })),
  };
}
