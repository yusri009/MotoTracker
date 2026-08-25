import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { MaintenanceRecord, MaintenanceType } from '@/models';
import { formatDocumentDate, formatKilometres } from '@/utils/maintenance';

export const MAINTENANCE_TYPE_COPY: Record<
  MaintenanceType,
  { label: string; icon: string }
> = {
  OIL_CHANGE: { label: 'Oil change', icon: '🛢️' },
  CHAIN_LUBRICATION: { label: 'Chain lubrication', icon: '⛓️' },
  SERVICE: { label: 'General service', icon: '🔧' },
  TYRE_CHANGE: { label: 'Tyre change', icon: '🛞' },
  BRAKE_MAINTENANCE: { label: 'Brake maintenance', icon: '🛑' },
  BATTERY: { label: 'Battery', icon: '🔋' },
  AIR_FILTER: { label: 'Air filter', icon: '🌬️' },
  OTHER: { label: 'Other', icon: '🧰' },
};

const costFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function MaintenanceHistory({ records }: { records: MaintenanceRecord[] }) {
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
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No maintenance recorded</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Oil changes, chain care, services, and manually added work will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.list, { borderColor: colors.border }]}>
      {records.map((record, index) => {
        const typeCopy = MAINTENANCE_TYPE_COPY[record.type];

        return (
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
              <View style={styles.titleRow}>
                <Text style={styles.icon}>{typeCopy.icon}</Text>
                <Text style={[styles.title, { color: colors.text }]}>{typeCopy.label}</Text>
              </View>
              <Text style={[styles.date, { color: colors.textMuted }]}>
                {formatDocumentDate(record.servicedAt)}
              </Text>
            </View>
            <Text style={[styles.odometer, { color: colors.textMuted }]}>
              {formatKilometres(record.odometer)} km
            </Text>
            {record.cost != null ? (
              <Text style={[styles.detail, { color: colors.textMuted }]}>Cost: {costFormatter.format(record.cost)}</Text>
            ) : null}
            {record.notes ? (
              <Text style={[styles.notes, { color: colors.textMuted }]}>{record.notes}</Text>
            ) : null}
          </View>
        );
      })}
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
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: { fontSize: 19 },
  title: { flex: 1, fontSize: 16, fontWeight: '800' },
  date: { fontSize: 12, fontWeight: '600' },
  odometer: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 13 },
  notes: { marginTop: Spacing.xs, fontSize: 14, lineHeight: 20 },
  empty: {
    padding: Spacing.lg,
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyText: { fontSize: 14, lineHeight: 20 },
});
