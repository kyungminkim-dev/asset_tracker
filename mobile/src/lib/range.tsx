import { createContext, type ReactNode, useContext, useState } from 'react';
import type { Range } from './api';

// 홈과 종목 탭이 같은 기간을 보도록 공유한다
const RangeContext = createContext<{ range: Range; setRange: (r: Range) => void }>({
  range: '1M',
  setRange: () => {},
});

export function RangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<Range>('1M');
  return <RangeContext.Provider value={{ range, setRange }}>{children}</RangeContext.Provider>;
}

export const useRange = () => useContext(RangeContext);

export const RANGE_LABEL: Record<Range, string> = {
  '1W': '1주',
  '1M': '1개월',
  '3M': '3개월',
  '6M': '6개월',
  '1Y': '1년',
  ALL: '전체',
};
