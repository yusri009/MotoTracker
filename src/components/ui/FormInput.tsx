import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useColorScheme,
  View,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const FormInput = forwardRef<TextInput, FormInputProps>(function FormInput(
  { label, error, hint, style, ...inputProps },
  ref,
) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? (
        <Text style={[styles.supportingText, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.supportingText, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    fontSize: 16,
  },
  supportingText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

