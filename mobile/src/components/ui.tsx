import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import type { Group } from '@/lib/api';
import { MARKET_LABEL, pct } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.section, { color: t.text }]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : 'transparent';
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? t.up : t.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.6 : 1, borderColor: variant === 'primary' ? bg : t.border },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, help, ...props }: TextInputProps & { label: string; help?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: t.sub }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.sub}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
      />
      {help ? <Text style={[styles.help, { color: t.sub }]}>{help}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label = (v) => v,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: (v: T) => string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: t.bg }]}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.segmentItem, on && { backgroundColor: t.card }]}
          >
            <Text style={{ color: on ? t.text : t.sub, fontWeight: on ? '700' : '500', fontSize: 13 }}>{label(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 비중을 한 줄 막대 + 범례로 */
export function AllocationBar({ groups, labelOf = (k) => MARKET_LABEL[k] ?? k }: { groups: Group[]; labelOf?: (k: string) => string }) {
  const t = useTheme();
  return (
    <View>
      <View style={styles.bar}>
        {groups.map((g, i) => (
          <View key={g.key} style={{ flex: g.weight, backgroundColor: t.palette[i % t.palette.length] }} />
        ))}
      </View>
      {groups.map((g, i) => (
        <View key={g.key} style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: t.palette[i % t.palette.length] }]} />
          <Text style={{ color: t.text, flex: 1 }}>{labelOf(g.key)}</Text>
          <Text style={{ color: t.sub }}>{pct(g.weight)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 18, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  button: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 16 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46, fontSize: 15 },
  help: { fontSize: 12, marginTop: 4 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
});
