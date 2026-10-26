import { manualInstitutions } from './catalog.js';
import { kis } from './kis.js';
import { manual } from './manual.js';
import { toss } from './toss.js';
import type { BrokerDefinition } from './types.js';

// 새 증권사는 여기에 추가한다. (_template.ts 참고) 순서대로 앱 목록에 보인다
const brokers: BrokerDefinition[] = [kis, toss, ...manualInstitutions, manual];

const byId = new Map(brokers.map((b) => [b.id, b]));
if (byId.size !== brokers.length) throw new Error('증권사 id 가 중복되었습니다.');

export function listBrokers() {
  return brokers.map(({ create: _create, ...meta }) => meta);
}

export function getBroker(id: string): BrokerDefinition {
  const broker = byId.get(id);
  if (!broker) throw new Error(`지원하지 않는 증권사: ${id}`);
  return broker;
}
