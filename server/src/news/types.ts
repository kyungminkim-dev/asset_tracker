/**
 * 뉴스 출처 플러그인 규격. 증권사처럼 출처를 바꾸거나 추가할 수 있다.
 * news/index.ts 가 설정에 따라 하나를 고른다.
 */
export interface NewsItem {
  title: string;
  url: string;
  source: string | null; // 언론사
  publishedAt: string | null; // ISO 8601
  summary: string | null;
}

export interface NewsProvider {
  id: string;
  name: string;
  /** 출처 이용 조건 등 앱에 보여줄 안내 */
  notice?: string;
  search(query: string, limit: number): Promise<NewsItem[]>;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** 뉴스 API 들이 주는 HTML 조각(<b> 태그, &quot; 등)을 평문으로 */
export function plainText(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** RFC 822 날짜 등 → ISO. 해석할 수 없으면 null */
export function toIso(date: string | undefined): string | null {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
