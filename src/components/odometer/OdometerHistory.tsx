import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { OdometerHistoryEntry } from '@/models';
import { formatDateTime } from '@/utils/date';
import { formatKilometres } from '@/utils/maintenance';

export function OdometerHistory({ entries }: { entries: OdometerHistoryEntry[] }) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  if (entries.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No readings yet</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Your saved updates will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.list, { borderColor: colors.border }]}>
      {entries.map((entry, index) => (
        <View
          key={entry.id}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: index === entries.length - 1 ? 0 : 1,
            },
          ]}
        >
          <View style={styles.readingRow}>
            <Text style={[styles.reading, { color: colors.text }]}>
              {formatKilometres(entry.odometer)} <Text style={styles.unit}>km</Text>
            </Text>
            {index === 0 ? (
              <View style={[styles.latestBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.latestText, { color: colors.primary }]}>LATEST</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.date, { color: colors.textMuted }]}>{formatDateTime(entry.recordedAt)}</Text>
          {entry.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{entry.note}</Text> : null}
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
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  reading: {
    fontSize: 21,
    fontWeight: '800',
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
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
  date: {
    fontSize: 13,
  },
  note: {
    marginTop: Spacing.xs,
    fontSize: 14,
    lineHeight: 20,
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
  },
});

