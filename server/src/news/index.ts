import { config } from '../config.js';
import { googleNews } from './google.js';
import { naverNews } from './naver.js';
import type { NewsItem, NewsProvider } from './types.js';

/** 네이버 키가 있으면 네이버(공식 API), 없으면 Google 뉴스 RSS */
export const newsProvider: NewsProvider = config.naver.clientId && config.naver.clientSecret ? naverNews : googleNews;

/** 종목에 맞는 검색어. 해외 종목은 이름만으로는 다른 뜻(예: 애플)이 섞여 "주식"을 붙인다 */
export function newsQuery(name: string, market: string) {
  return market === 'KR' ? name : `${name} 주식`;
}

// 같은 검색어는 10분 동안 다시 묻지 않는다 (호출 한도·응답 속도)
const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; items: Promise<NewsItem[]> }>();

export function searchNews(query: string, limit = 20): Promise<NewsItem[]> {
  const key = `${newsProvider.id}:${query}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.items;

  const items = newsProvider.search(query, limit);
  cache.set(key, { at: Date.now(), items });
  // 실패한 결과는 캐시하지 않는다
  items.catch(() => cache.delete(key));
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return items;
}
