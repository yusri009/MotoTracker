import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { VehicleDocument } from '@/models';
import { formatDocumentDate } from '@/utils/maintenance';

const costFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function InsuranceHistory({ policies }: { policies: VehicleDocument[] }) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  if (policies.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No policies saved</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Your current and previous insurance policies will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.list, { borderColor: colors.border }]}>
      {policies.map((policy, index) => (
        <View
          key={policy.id}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: index === policies.length - 1 ? 0 : 1,
            },
          ]}
        >
          <View style={styles.heading}>
            <Text style={[styles.provider, { color: colors.text }]} numberOfLines={1}>
              {policy.provider || 'Insurance policy'}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: policy.isActive ? colors.successSoft : colors.accentSoft },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: policy.isActive ? colors.success : colors.textMuted },
                ]}
              >
                {policy.isActive ? 'CURRENT' : 'PREVIOUS'}
              </Text>
            </View>
          </View>
          {policy.policyNumber ? (
            <Text style={[styles.policyNumber, { color: colors.textMuted }]}>
              Policy {policy.policyNumber}
            </Text>
          ) : null}
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            {formatDocumentDate(policy.startDate)} – {formatDocumentDate(policy.expiryDate)}
          </Text>
          {policy.cost != null ? (
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              Premium: {costFormatter.format(policy.cost)}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  row: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  provider: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  policyNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    lineHeight: 19,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  empty: {
    padding: Spacing.lg,
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
