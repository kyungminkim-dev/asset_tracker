import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { Range } from './api';

/** 조회 기간: 미리 정해진 기간(1주~전체) 또는 사용자가 고른 날짜 범위 */
export type Period = { range: Range } | { range: 'CUSTOM'; from: string; to: string };

export const RANGE_LABEL: Record<Range, string> = {
  '1W': '1주',
  '1M': '1개월',
  '3M': '3개월',
  '6M': '6개월',
  '1Y': '1년',
  ALL: '전체',
};

/** 서버 조회용 쿼리 문자열 */
export function periodQuery(p: Period) {
  return p.range === 'CUSTOM' ? `from=${p.from}&to=${p.to}` : `range=${p.range}`;
}

/** 2026-03-05 → 26.03.05 */
const shortDate = (d: string) => d.slice(2).replace(/-/g, '.');

/** 칩/제목용 짧은 이름 */
export function periodLabel(p: Period) {
  return p.range === 'CUSTOM' ? `${shortDate(p.from)} ~ ${shortDate(p.to)}` : RANGE_LABEL[p.range];
}

/** 문장용: "1개월 전보다" / "26.01.01 ~ 26.03.31 동안" */
export function periodPhrase(p: Period) {
  return p.range === 'CUSTOM' ? `${periodLabel(p)} 동안` : p.range === 'ALL' ? '처음보다' : `${RANGE_LABEL[p.range]} 전보다`;
}

// 홈과 주식 탭이 같은 기간을 보도록 공유한다
const PeriodContext = createContext<{
  period: Period;
  setRange: (r: Range) => void;
  setCustom: (from: string, to: string) => void;
}>({ period: { range: '1M' }, setRange: () => {}, setCustom: () => {} });

export function RangeProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>({ range: '1M' });
  const setRange = useCallback((range: Range) => setPeriod({ range }), []);
  const setCustom = useCallback((from: string, to: string) => setPeriod({ range: 'CUSTOM', from, to }), []);
  const value = useMemo(() => ({ period, setRange, setCustom }), [period, setRange, setCustom]);
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export const usePeriod = () => useContext(PeriodContext);
