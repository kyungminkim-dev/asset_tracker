const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

const isHangulSyllable = (ch: string) => {
  const c = ch.charCodeAt(0);
  return c >= HANGUL_START && c <= HANGUL_END;
};

/** "삼성전자" → "ㅅㅅㅈㅈ" (한글 음절이 아닌 글자는 그대로) */
export function chosung(text: string) {
  return [...text]
    .map((ch) => (isHangulSyllable(ch) ? CHOSUNG[Math.floor((ch.charCodeAt(0) - HANGUL_START) / 588)] : ch))
    .join('');
}

const isAllChosung = (q: string) => [...q].every((ch) => CHOSUNG.includes(ch));

/** 이름·코드에 검색어가 들어 있거나, 초성만 입력했을 때 초성이 맞으면 true */
export function matchesStock(query: string, stock: { name: string; symbol: string }) {
  const q = query.replace(/\s+/g, '').toLowerCase();
  if (!q) return true;
  const name = stock.name.replace(/\s+/g, '').toLowerCase();
  if (name.includes(q) || stock.symbol.toLowerCase().includes(q)) return true;
  return isAllChosung(q) && chosung(name).includes(q);
}

/** 가나다순. 한글로 시작하는 이름이 먼저, 그 뒤에 영문·숫자 이름을 알파벳순으로 */
export function compareKorean(a: string, b: string) {
  const ha = isHangulSyllable(a[0] ?? '');
  const hb = isHangulSyllable(b[0] ?? '');
  if (ha !== hb) return ha ? -1 : 1;
  return a.localeCompare(b, 'ko');
}
