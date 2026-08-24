import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatKilometres } from '@/utils/maintenance';

interface OdometerCardProps {
  currentOdometer: number;
  onPress: () => void;
}

export function OdometerCard({ currentOdometer, onPress }: OdometerCardProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Update odometer"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🛣️</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: colors.textMuted }]}>CURRENT ODOMETER</Text>
        <Text style={[styles.value, { color: colors.text }]}>
          {formatKilometres(currentOdometer)} <Text style={styles.unit}>km</Text>
        </Text>
      </View>
      <View style={[styles.action, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.actionText, { color: colors.primary }]}>Update</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 28,
  },
  copy: {
    flex: 1,
    gap: Spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
  },
  unit: {
    fontSize: 17,
    fontWeight: '600',
  },
  action: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
