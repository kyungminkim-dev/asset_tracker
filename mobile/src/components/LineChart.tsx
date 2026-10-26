import { useMemo, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import type { HistoryPoint } from '@/lib/api';
import { krw, krwShort } from '@/lib/format';
import { useTheme } from '@/lib/theme';

interface Props {
  points: HistoryPoint[];
  color: string;
  height?: number;
  /** 손가락으로 그래프를 짚을 때 선택된 지점 (놓으면 null) */
  onScrub?: (point: HistoryPoint | null) => void;
}

const PAD_Y = 12;

export function LineChart({ points, color, height = 200, onScrub }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const values = points.flatMap((p) => [p.value, p.cost]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.max(max * 0.01, 1);
    const x = (i: number) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * width);
    const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (height - PAD_Y * 2);
    const line = (key: 'value' | 'cost') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ');
    const value = line('value');
    return { x, y, min, max, value, cost: line('cost'), area: `${value} L${x(points.length - 1)},${height} L${x(0)},${height} Z` };
  }, [points, width, height]);

  const handleTouch = (e: GestureResponderEvent) => {
    if (!geo || points.length === 0) return;
    const i = Math.round((e.nativeEvent.locationX / width) * (points.length - 1));
    const idx = Math.max(0, Math.min(points.length - 1, i));
    setActive(idx);
    onScrub?.(points[idx]!);
  };
  const release = () => {
    setActive(null);
    onScrub?.(null);
  };

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: t.sub, fontSize: 14 }}>아직 기록이 없어요. 동기화하면 오늘부터 쌓여요.</Text>
      </View>
    );
  }

  return (
    <View>
      <View
        style={{ height }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={release}
        onResponderTerminate={release}
      >
        {geo && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.14} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={geo.area} fill="url(#fill)" />
            {/* 점선: 투자원금(매입금액 + 예수금) */}
            <Path d={geo.cost} stroke={t.sub} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 4" fill="none" />
            <Path d={geo.value} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {active !== null && (
              <>
                <Line x1={geo.x(active)} x2={geo.x(active)} y1={0} y2={height} stroke={t.border} strokeWidth={1} />
                <Circle cx={geo.x(active)} cy={geo.y(points[active]!.value)} r={5} fill={color} stroke={t.card} strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisText, { color: t.sub }]}>{points[0]!.date}</Text>
        <Text style={[styles.axisText, { color: t.sub }]}>
          {geo ? `${krwShort(geo.min)} ~ ${krwShort(geo.max)}` : ''}
        </Text>
        <Text style={[styles.axisText, { color: t.sub }]}>{points[points.length - 1]!.date}</Text>
      </View>
      {active !== null && (
        <Text style={[styles.axisText, { color: t.sub, textAlign: 'center' }]}>
          투자원금 {krw(points[active]!.cost)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontSize: 11 },
});
