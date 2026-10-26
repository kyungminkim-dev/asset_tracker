import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import type { Group } from '@/lib/api';
import { MARKET_LABEL, pct } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Icon, type IconName } from './Icon';

/** 회색 바탕 위의 흰(다크: 짙은 회색) 둥근 섹션 */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  const t = useTheme();
  return <View style={[styles.card, padded && styles.cardPadded, { backgroundColor: t.card }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Caption({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[{ color: t.sub, fontSize: 13, lineHeight: 19 }, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'weak' | 'neutral' | 'danger';

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  size = 'large',
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  icon?: IconName;
}) {
  const t = useTheme();
  const colors: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: t.primary, fg: t.onPrimary },
    weak: { bg: t.primaryWeak, fg: t.primaryWeakText },
    neutral: { bg: t.fill, fg: t.text2 },
    danger: { bg: t.dangerWeak, fg: t.danger },
  };
  const { bg, fg } = colors[variant];
  const height = size === 'large' ? 56 : size === 'medium' ? 48 : 34;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          borderRadius: size === 'small' ? 10 : 16,
          paddingHorizontal: size === 'small' ? 12 : 20,
          backgroundColor: bg,
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? (
            <View style={{ marginRight: 6 }}>
              <Icon name={icon} size={size === 'small' ? 16 : 20} color={fg} />
            </View>
          ) : null}
          <Text style={{ color: fg, fontSize: size === 'large' ? 17 : size === 'medium' ? 15 : 13, fontWeight: '700' }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, help, ...props }: TextInputProps & { label: string; help?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.label, { color: t.text2 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.sub}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardAppearance={t.scheme}
        {...props}
        style={[styles.input, { color: t.text, backgroundColor: t.fill }]}
      />
      {help ? <Text style={[styles.help, { color: t.sub }]}>{help}</Text> : null}
    </View>
  );
}

/** 기간·정렬 선택 칩. 선택된 항목만 회색 알약 배경 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label = (v) => v,
  stretch = false,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: (v: T) => string;
  stretch?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.chips, stretch && { justifyContent: 'space-between' }]}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            hitSlop={4}
            style={[styles.chip, stretch && { flex: 1 }, on && { backgroundColor: t.fill }]}
          >
            <Text numberOfLines={1} style={{ color: on ? t.text : t.sub, fontWeight: on ? '700' : '500', fontSize: 14 }}>
              {label(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 이니셜이 들어간 동그란 아바타. 같은 키는 항상 같은 색 */
export function Avatar({ label, colorKey, size = 40 }: { label: string; colorKey?: string; size?: number }) {
  const t = useTheme();
  const key = colorKey ?? label;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const color = t.palette[Math.abs(hash) % (t.palette.length - 1)]!;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: size * 0.4 }}>{label.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

/** 토스 스타일 목록 행: 왼쪽 아바타/아이콘, 제목·부제, 오른쪽 값 */
export function ListRow({
  left,
  title,
  subtitle,
  right,
  rightSub,
  rightColor,
  rightSubColor,
  chevron,
  onPress,
  onLongPress,
  titleColor,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
  rightColor?: string;
  rightSubColor?: string;
  chevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  titleColor?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.fill }]}
    >
      {left ? <View style={{ marginRight: 14 }}>{left}</View> : null}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={[styles.rowTitle, { color: titleColor ?? t.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: t.sub }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right || rightSub ? (
        <View style={{ alignItems: 'flex-end' }}>
          {right ? <Text style={[styles.rowTitle, { color: rightColor ?? t.text }]}>{right}</Text> : null}
          {rightSub ? <Text style={[styles.rowSub, { color: rightSubColor ?? t.sub }]}>{rightSub}</Text> : null}
        </View>
      ) : null}
      {chevron ? (
        <View style={{ marginLeft: 4 }}>
          <Icon name="chevron-right" size={18} color={t.sub} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** 왼쪽 라벨, 오른쪽 값 한 줄 (요약 정보용) */
export function InfoRow({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
  const t = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={{ color: t.sub, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: valueColor ?? t.text, fontSize: 15, fontWeight: '600' }}>
        {value}
        {sub ? <Text style={{ fontWeight: '500' }}> {sub}</Text> : null}
      </Text>
    </View>
  );
}

/** 비중을 한 줄 막대 + 범례로 */
export function AllocationBar({ groups, labelOf = (k) => MARKET_LABEL[k] ?? k }: { groups: Group[]; labelOf?: (k: string) => string }) {
  const t = useTheme();
  return (
    <View>
      <View style={[styles.bar, { backgroundColor: t.fill }]}>
        {groups.map((g, i) => (
          <View key={g.key} style={{ flex: g.weight, backgroundColor: t.palette[i % t.palette.length], marginRight: i < groups.length - 1 ? 2 : 0 }} />
        ))}
      </View>
      {groups.map((g, i) => (
        <View key={g.key} style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: t.palette[i % t.palette.length] }]} />
          <Text style={{ color: t.text2, flex: 1, fontSize: 15 }}>{labelOf(g.key)}</Text>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{pct(g.weight)}</Text>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      {description ? <Caption style={{ textAlign: 'center', marginBottom: action ? 20 : 0 }}>{description}</Caption> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, marginBottom: 12, overflow: 'hidden' },
  cardPadded: { padding: 20, paddingHorizontal: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 14, paddingHorizontal: 16, height: 52, fontSize: 16 },
  help: { fontSize: 13, marginTop: 6 },
  chips: { flexDirection: 'row', gap: 4 },
  chip: { alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 22 },
  rowTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  rowSub: { fontSize: 13, marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
});
