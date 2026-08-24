import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { MaintenanceRecord } from '@/models';
import { formatDocumentDate, formatKilometres } from '@/utils/maintenance';

export function ChainLubricationHistory({ records }: { records: MaintenanceRecord[] }) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  if (records.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No lubrication events recorded</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Use “Mark Chain Lubed” after lubricating the chain.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.list, { borderColor: colors.border }]}>
      {records.map((record, index) => (
        <View
          key={record.id}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: index === records.length - 1 ? 0 : 1,
            },
          ]}
        >
          <View style={styles.heading}>
            <Text style={[styles.date, { color: colors.text }]}>
              {formatDocumentDate(record.servicedAt)}
            </Text>
            {index === 0 ? (
              <View style={[styles.latestBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.latestText, { color: colors.primary }]}>LATEST</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.odometer, { color: colors.textMuted }]}>
            {formatKilometres(record.odometer)} km
          </Text>
          {record.notes ? <Text style={[styles.notes, { color: colors.textMuted }]}>{record.notes}</Text> : null}
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
  date: {
    fontSize: 17,
    fontWeight: '800',
  },
  odometer: {
    fontSize: 14,
    fontWeight: '600',
  },
  notes: {
    marginTop: Spacing.xs,
    fontSize: 14,
    lineHeight: 20,
  },
  latestBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  latestText: {
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

