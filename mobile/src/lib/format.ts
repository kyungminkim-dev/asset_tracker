const krwFmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

export const krw = (n: number) => `${krwFmt.format(Math.round(n))}원`;

/** 1억 2,345만원 처럼 큰 금액을 짧게 */
export function krwShort(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(abs >= 1e10 ? 0 : 2)}억`;
  if (abs >= 1e4) return `${sign}${krwFmt.format(Math.round(abs / 1e4))}만`;
  return `${sign}${krwFmt.format(Math.round(abs))}`;
}

export const signed = (n: number, fmt: (n: number) => string) => (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n));

export const pct = (r: number) => `${(r * 100).toFixed(2)}%`;

export function price(n: number, currency: string) {
  if (currency === 'KRW') return krw(n);
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)} ${currency}`;
}

export const MARKET_LABEL: Record<string, string> = {
  KR: '국내',
  US: '미국',
  JP: '일본',
  HK: '홍콩',
  CN: '중국',
  VN: '베트남',
  OTHER: '기타',
  CASH: '예수금',
};
