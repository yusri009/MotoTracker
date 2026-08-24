import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { DashboardStatus } from '@/utils/maintenance';

const statusLabels: Record<DashboardStatus, string> = {
  NORMAL: 'On track',
  DUE_SOON: 'Due soon',
  OVERDUE: 'Overdue',
  EXPIRED: 'Expired',
  UNCONFIGURED: 'Set up',
};

export function StatusBadge({ status }: { status: DashboardStatus }) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const palette = {
    NORMAL: { foreground: colors.success, background: colors.successSoft },
    DUE_SOON: { foreground: colors.warning, background: colors.warningSoft },
    OVERDUE: { foreground: colors.danger, background: colors.dangerSoft },
    EXPIRED: { foreground: colors.danger, background: colors.dangerSoft },
    UNCONFIGURED: { foreground: colors.primary, background: colors.accentSoft },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.foreground }]}>{statusLabels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

