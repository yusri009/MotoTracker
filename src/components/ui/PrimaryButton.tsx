import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? colors.primary : colors.surface;
  const textColor = isPrimary ? (isDark ? '#101216' : '#FFFFFF') : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: isPrimary ? backgroundColor : colors.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
});
