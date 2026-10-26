import { config } from '../config.js';
import { type NewsProvider, plainText, toIso } from './types.js';

/**
 * 네이버 검색 API (뉴스) — https://developers.naver.com/docs/serviceapi/search/news/news.md
 * 공식 API, 하루 25,000회 무료. 네이버 개발자센터에서 애플리케이션을 등록해 Client ID / Secret 을 받는다.
 */
export const naverNews: NewsProvider = {
  id: 'naver',
  name: '네이버 뉴스',
  async search(query, limit) {
    const url = `https://openapi.naver.com/v1/search/news.json?${new URLSearchParams({
      query,
      display: String(Math.min(limit, 100)),
      sort: 'date',
    })}`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': config.naver.clientId,
        'X-Naver-Client-Secret': config.naver.clientSecret,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`네이버 뉴스 검색 실패: HTTP ${res.status}`);
    const body = (await res.json()) as {
      items?: { title: string; originallink?: string; link: string; description?: string; pubDate?: string }[];
    };
    return (body.items ?? []).map((it) => ({
      title: plainText(it.title),
      // 언론사 원문 주소가 있으면 원문으로, 없으면 네이버 뉴스 주소로
      url: it.originallink || it.link,
      source: sourceFromUrl(it.originallink || it.link),
      publishedAt: toIso(it.pubDate),
      summary: it.description ? plainText(it.description) : null,
    }));
  },
};

/** 네이버 API 는 언론사 이름을 주지 않아 원문 도메인으로 대신 표시한다 */
function sourceFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^(www|m|news)\./, '');
  } catch {
    return null;
  }
}
