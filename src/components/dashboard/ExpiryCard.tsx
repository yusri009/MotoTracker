import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { DateExpiryCalculation } from '@/utils/maintenance';
import { describeDaysRemaining, formatDocumentDate } from '@/utils/maintenance';

interface ExpiryCardProps {
  title: string;
  icon: string;
  expiryDate: string | null;
  calculation: DateExpiryCalculation | null;
  onPress?: () => void;
}

export function ExpiryCard({ title, icon, expiryDate, calculation, onPress }: ExpiryCardProps) {
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

      {expiryDate && calculation ? (
        <View style={styles.details}>
          <Text style={[styles.label, { color: colors.textMuted }]}>EXPIRES</Text>
          <Text style={[styles.value, { color: colors.text }]}>{formatDocumentDate(expiryDate)}</Text>
          <Text
            style={[
              styles.remaining,
              {
                color:
                  status === 'EXPIRED'
                    ? colors.danger
                    : status === 'DUE_SOON'
                      ? colors.warning
                      : colors.textMuted,
              },
            ]}
          >
            {describeDaysRemaining(calculation.daysRemaining)}
          </Text>
        </View>
      ) : (
        <View style={styles.details}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Not configured</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Add the document dates to enable expiry tracking.</Text>
        </View>
      )}
      {onPress ? (
        <Text style={[styles.manage, { color: colors.primary }]}>Manage document →</Text>
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
    fontSize: 22,
    fontWeight: '800',
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
