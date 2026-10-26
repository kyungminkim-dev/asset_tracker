import { kis } from './kis.js';
import { manual } from './manual.js';
import { toss } from './toss.js';
import type { BrokerDefinition } from './types.js';

// 새 증권사는 여기에 추가한다. (_template.ts 참고)
const brokers: BrokerDefinition[] = [kis, toss, manual];

const byId = new Map(brokers.map((b) => [b.id, b]));

export function listBrokers() {
  return brokers.map(({ create: _create, ...meta }) => meta);
}

export function getBroker(id: string): BrokerDefinition {
  const broker = byId.get(id);
  if (!broker) throw new Error(`지원하지 않는 증권사: ${id}`);
  return broker;
}
