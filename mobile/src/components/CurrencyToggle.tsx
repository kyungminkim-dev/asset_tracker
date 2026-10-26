import { type DisplayCurrency, useCurrency } from '@/lib/currency';
import { Chips } from './ui';

/** ₩ / $ 전환. 홈·주식 탭이 같은 설정을 공유해 한 곳에서 바꾸면 모두 바뀐다 */
export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();
  return (
    <Chips
      options={['KRW', 'USD'] as const}
      value={currency}
      onChange={(c: DisplayCurrency) => setCurrency(c)}
      label={(c) => (c === 'KRW' ? '₩' : '$')}
    />
  );
}
