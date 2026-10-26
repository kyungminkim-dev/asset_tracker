import { type NewsItem, type NewsProvider, plainText, toIso } from './types.js';

/**
 * Google 뉴스 RSS. 키 없이 쓸 수 있지만 피드 자체에 "개인용·비상업적 용도로만" 이라고 명시돼 있다.
 * 개발·개인용 기본값으로만 쓰고, 공개 서비스는 네이버 검색 API(NAVER_CLIENT_ID)를 설정한다.
 */
export const googleNews: NewsProvider = {
  id: 'google',
  name: 'Google 뉴스',
  notice: 'Google 뉴스 RSS 는 개인·비상업적 용도로만 사용할 수 있어요.',
  async search(query, limit) {
    const url = `https://news.google.com/rss/search?${new URLSearchParams({ q: query, hl: 'ko', gl: 'KR', ceid: 'KR:ko' })}`;
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Google 뉴스 RSS 실패: HTTP ${res.status}`);
    const xml = await res.text();

    const items: NewsItem[] = [];
    for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const tag = (name: string) => block!.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1];
      const source = tag('source') ? plainText(tag('source')!) : null;
      let title = plainText(tag('title') ?? '');
      // 제목 끝의 " - 언론사" 를 떼어낸다
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      const link = tag('link');
      if (!title || !link) continue;
      items.push({ title, url: plainText(link), source, publishedAt: toIso(tag('pubDate')), summary: null });
      if (items.length >= limit) break;
    }
    return items;
  },
};
