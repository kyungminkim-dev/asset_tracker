import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'chart'
  | 'wallet'
  | 'menu'
  | 'chevron-right'
  | 'check'
  | 'plus'
  | 'refresh'
  | 'sun'
  | 'moon'
  | 'phone'
  | 'logout'
  | 'server'
  | 'trash'
  | 'calendar';

/** 앱 전용 단색 아이콘 (24 그리드, 2px 선) */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: ColorValue }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...stroke} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />}
      {name === 'chart' && <Path {...stroke} d="M3 17l5-5 4 4 8-9M15 7h5v5" />}
      {name === 'wallet' && (
        <>
          <Rect {...stroke} x={3} y={6} width={18} height={14} rx={3} />
          <Path {...stroke} d="M16 13h2M3 10h18M7 6V4h10v2" />
        </>
      )}
      {name === 'menu' && <Path {...stroke} d="M4 7h16M4 12h16M4 17h16" />}
      {name === 'chevron-right' && <Path {...stroke} d="M9 6l6 6-6 6" />}
      {name === 'check' && <Path {...stroke} strokeWidth={2.5} d="M5 12.5l4.5 4.5L19 7.5" />}
      {name === 'plus' && <Path {...stroke} d="M12 5v14M5 12h14" />}
      {name === 'refresh' && <Path {...stroke} d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />}
      {name === 'sun' && (
        <>
          <Circle {...stroke} cx={12} cy={12} r={4} />
          <Path {...stroke} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
      {name === 'moon' && <Path {...stroke} d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />}
      {name === 'phone' && (
        <>
          <Rect {...stroke} x={6} y={2} width={12} height={20} rx={3} />
          <Path {...stroke} d="M11 18h2" />
        </>
      )}
      {name === 'logout' && <Path {...stroke} d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />}
      {name === 'server' && (
        <>
          <Rect {...stroke} x={3} y={4} width={18} height={7} rx={2} />
          <Rect {...stroke} x={3} y={13} width={18} height={7} rx={2} />
          <Path {...stroke} d="M7 7.5h.01M7 16.5h.01" />
        </>
      )}
      {name === 'trash' && <Path {...stroke} d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />}
      {name === 'calendar' && (
        <>
          <Rect {...stroke} x={3} y={5} width={18} height={16} rx={3} />
          <Path {...stroke} d="M3 10h18M8 3v4M16 3v4" />
        </>
      )}
    </Svg>
  );
}
