import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useThemePreference } from '@/hooks/useThemePreference';

export function ThemeToggleButton() {
  const { isDark, ready, toggleTheme } = useThemePreference();
  const colors = isDark ? Colors.dark : Colors.light;
  const targetTheme = isDark ? 'light' : 'dark';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`Switch to ${targetTheme} theme`}
      accessibilityState={{ checked: isDark, disabled: !ready }}
      disabled={!ready}
      onPress={() => void toggleTheme().catch(() => undefined)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: !ready ? 0.55 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconBubble,
          { backgroundColor: isDark ? colors.warningSoft : colors.accentSoft },
        ]}
      >
        <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>
        {isDark ? 'Light' : 'Dark'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  iconBubble: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  icon: { fontSize: 15 },
  label: { fontSize: 12, fontWeight: '800' },
});
