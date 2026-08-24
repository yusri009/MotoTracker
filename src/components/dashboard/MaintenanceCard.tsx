import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { KmMaintenanceCalculation } from '@/utils/maintenance';
import { describeRemainingKm, formatKilometres } from '@/utils/maintenance';

interface MaintenanceCardProps {
  title: string;
  icon: string;
  calculation: KmMaintenanceCalculation | null;
  onPress?: () => void;
}

export function MaintenanceCard({ title, icon, calculation, onPress }: MaintenanceCardProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const status = calculation?.status ?? 'UNCONFIGURED';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
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
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      {calculation ? (
        <View style={styles.details}>
          <Text style={[styles.label, { color: colors.textMuted }]}>NEXT AT</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {formatKilometres(calculation.nextServiceKm)} <Text style={styles.unit}>km</Text>
          </Text>
          <Text
            style={[
              styles.remaining,
              {
                color:
                  status === 'OVERDUE'
                    ? colors.danger
                    : status === 'DUE_SOON'
                      ? colors.warning
                      : colors.textMuted,
              },
            ]}
          >
            {describeRemainingKm(calculation.remainingKm)}
          </Text>
        </View>
      ) : (
        <View style={styles.details}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Not configured</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Add the last service reading and interval to start tracking.</Text>
        </View>
      )}
      {onPress ? (
        <Text style={[styles.manage, { color: colors.primary }]}>Manage reminder →</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  details: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  value: {
    fontSize: 25,
    fontWeight: '800',
  },
  unit: {
    fontSize: 15,
    fontWeight: '600',
  },
  remaining: {
    marginTop: Spacing.xs,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  manage: {
    fontSize: 13,
    fontWeight: '700',
  },
});
