import * as SecureStore from 'expo-secure-store';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { krw, krwShort, signed, usd, usdShort } from './format';

/** 자산을 보여줄 통화. 서버는 모두 원화로 계산해 주고, 달러는 앱에서 그 시점 환율로 바꾼다 */
export type DisplayCurrency = 'KRW' | 'USD';

export const CURRENCY_LABEL: Record<DisplayCurrency, string> = { KRW: '원화 (₩)', USD: '달러 ($)' };

const STORAGE_KEY = 'display_currency';

const CurrencyContext = createContext<{ currency: DisplayCurrency; setCurrency: (c: DisplayCurrency) => void }>({
  currency: 'KRW',
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setState] = useState<DisplayCurrency>('KRW');

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => saved === 'USD' && setState('USD'))
      .catch(() => {});
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setState(c);
    SecureStore.setItemAsync(STORAGE_KEY, c).catch(() => {});
  }, []);

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);

/**
 * 원화 금액을 고른 통화로 보여주는 함수들.
 * rate 는 그 금액 시점의 USD 환율(1달러당 원). 환율을 모르면 원화로 보여준다.
 */
export function useMoney() {
  const { currency } = useCurrency();
  return useMemo(() => {
    const inUsd = (rate?: number | null): rate is number => currency === 'USD' && !!rate;
    return {
      currency,
      /** 원화 금액 → 표시 통화 숫자 */
      convert: (amountKrw: number, rate?: number | null) => (inUsd(rate) ? amountKrw / rate : amountKrw),
      /** 이미 표시 통화로 바꾼 숫자를 쓰는 곳(그래프)용 서식. converted=false 면 원화 그대로인 숫자 */
      formatter: (converted: boolean) =>
        currency === 'USD' && converted ? { full: usd, short: usdShort } : { full: krw, short: krwShort },
      money: (amountKrw: number, rate?: number | null) => (inUsd(rate) ? usd(amountKrw / rate) : krw(amountKrw)),
      moneySigned: (amountKrw: number, rate?: number | null) =>
        inUsd(rate) ? signed(amountKrw / rate, usd) : signed(amountKrw, krw),
    };
  }, [currency]);
}
