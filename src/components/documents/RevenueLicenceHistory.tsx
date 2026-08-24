import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { VehicleDocument } from '@/models';
import { formatDocumentDate } from '@/utils/maintenance';

const costFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function RevenueLicenceHistory({ licences }: { licences: VehicleDocument[] }) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  if (licences.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No licences saved</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Your current and previous revenue licences will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.list, { borderColor: colors.border }]}>
      {licences.map((licence, index) => (
        <View
          key={licence.id}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: index === licences.length - 1 ? 0 : 1,
            },
          ]}
        >
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.text }]}>Revenue licence</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: licence.isActive ? colors.successSoft : colors.accentSoft },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: licence.isActive ? colors.success : colors.textMuted },
                ]}
              >
                {licence.isActive ? 'CURRENT' : 'PREVIOUS'}
              </Text>
            </View>
          </View>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            Issued {formatDocumentDate(licence.startDate)}
          </Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            Expires {formatDocumentDate(licence.expiryDate)}
          </Text>
          {licence.cost != null ? (
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              Cost: {costFormatter.format(licence.cost)}
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
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
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
