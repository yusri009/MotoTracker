import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormInput } from '@/components/ui/FormInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { Vehicle } from '@/models';
import { documentReminderService } from '@/services/documentReminderService';
import { IS_EXPO_GO, type ReminderScheduleResult } from '@/services/notificationService';
import { backupService } from '@/services/backupService';

interface ReminderForm {
  insuranceDays: string;
  licenceDays: string;
}

type FieldErrors = Partial<Record<keyof ReminderForm, string>>;

function parseReminderDays(value: string) {
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const days = parts.map(Number);

  if (
    days.length === 0 ||
    days.length > 10 ||
    days.some((day) => !Number.isSafeInteger(day) || day < 0 || day > 365)
  ) {
    return null;
  }

  return [...new Set(days)].sort((left, right) => right - left);
}

function reminderResultWarning(results: Array<ReminderScheduleResult | null>) {
  const statuses = results.filter((result): result is ReminderScheduleResult => result != null);
  if (statuses.some((result) => result.status === 'development_build_required')) {
    return 'Preferences were saved. Expo Go cannot schedule notifications; installed builds will use these reminder days.';
  }
  if (statuses.some((result) => result.status === 'denied')) {
    return 'Preferences were saved, but notifications are disabled in Android settings.';
  }
  if (statuses.some((result) => result.status === 'unavailable')) {
    return 'Preferences were saved, but one or more notifications could not be rescheduled.';
  }
  return null;
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Settings could not be saved.';
}

export default function SettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<ReminderForm>({ insuranceDays: '', licenceDays: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [screenState, setScreenState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (database.state === 'initializing') {
      setScreenState('loading');
      return;
    }
    if (database.state === 'error') {
      setError(database.error);
      setScreenState('error');
      return;
    }

    let active = true;
    setScreenState('loading');
    setError(null);

    void (async () => {
      const savedVehicle = await vehicleRepository.getPrimary();
      const preferences = savedVehicle
        ? await documentReminderService.load(savedVehicle.id)
        : null;

      if (!active) return;
      setVehicle(savedVehicle);
      setForm({
        insuranceDays: preferences?.insuranceDays.join(', ') ?? '',
        licenceDays: preferences?.licenceDays.join(', ') ?? '',
      });
      setScreenState('ready');
    })().catch((reason: unknown) => {
      if (active) {
        setError(getErrorMessage(reason));
        setScreenState('error');
      }
    });

    return () => {
      active = false;
    };
  }, [database.error, database.state, reloadKey]);

  function updateField(field: keyof ReminderForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
    setSuccess(null);
    setWarning(null);
  }

  async function saveSettings() {
    if (!vehicle || saving) return;

    const insuranceDays = parseReminderDays(form.insuranceDays);
    const licenceDays = parseReminderDays(form.licenceDays);
    const errors: FieldErrors = {};
    if (!insuranceDays) errors.insuranceDays = 'Enter 1–10 unique days from 0 to 365.';
    if (!licenceDays) errors.licenceDays = 'Enter 1–10 unique days from 0 to 365.';
    setFieldErrors(errors);
    if (!insuranceDays || !licenceDays) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    try {
      const insuranceResult = await documentReminderService.save(
        vehicle.id,
        'INSURANCE',
        insuranceDays,
      );
      const licenceResult = await documentReminderService.save(
        vehicle.id,
        'REVENUE_LICENCE',
        licenceDays,
      );
      setForm({
        insuranceDays: insuranceResult.days.join(', '),
        licenceDays: licenceResult.days.join(', '),
      });
      setSuccess(`Reminder preferences saved for ${vehicle.name}.`);
      setWarning(
        reminderResultWarning([
          insuranceResult.reminderResult,
          licenceResult.reminderResult,
        ]),
      );
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function exportBackup() {
    if (exporting) return;

    setExporting(true);
    setError(null);
    setSuccess(null);
    setWarning(null);
    try {
      const result = await backupService.exportAllData();
      setSuccess(
        `Backup shared: ${result.vehicleCount} vehicles, ${result.maintenanceRecordCount} maintenance records, and ${result.documentCount} documents.`,
      );
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setExporting(false);
    }
  }

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading settings…</Text>
      </SafeAreaView>
    );
  }

  if (screenState === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Settings unavailable</Text>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <PrimaryButton title="Try again" onPress={() => setReloadKey((value) => value + 1)} />
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>No vehicle profile</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Create a vehicle before changing reminder settings.</Text>
          <PrimaryButton title="Go home" onPress={() => router.replace('/' as Href)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>Settings & data</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Preferences for {vehicle.name}. Enter reminder days separated by commas.</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Document reminders</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Use 0 to receive an alert on the expiry date. Existing future alerts are rescheduled when saved.</Text>
            <FormInput
              label="Insurance reminder days"
              placeholder="30, 14, 7, 1"
              value={form.insuranceDays}
              error={fieldErrors.insuranceDays}
              keyboardType="numbers-and-punctuation"
              onChangeText={(value) => updateField('insuranceDays', value)}
            />
            <FormInput
              label="Revenue licence reminder days"
              placeholder="30, 14, 7, 1"
              value={form.licenceDays}
              error={fieldErrors.licenceDays}
              keyboardType="numbers-and-punctuation"
              onChangeText={(value) => updateField('licenceDays', value)}
            />
            <PrimaryButton title="Save reminder preferences" loading={saving} onPress={() => void saveSettings()} />
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.infoIcon}>🔔</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {IS_EXPO_GO
                ? 'Expo Go saves these preferences but cannot schedule notifications. They become active in a development or production build.'
                : 'Notifications are stored locally on this device and do not require an account or internet connection.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Backup export</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Creates a JSON file containing all vehicles, mileage, maintenance, documents, and preferences. Vehicle photo files are not embedded.</Text>
            <PrimaryButton
              title="Export all MotoTracker data"
              variant="secondary"
              loading={exporting}
              onPress={() => void exportBackup()}
            />
          </View>

          {success ? (
            <View style={[styles.feedback, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.feedbackText, { color: colors.success }]}>{success}</Text>
            </View>
          ) : null}
          {warning ? (
            <View style={[styles.feedback, { backgroundColor: colors.warningSoft }]}>
              <Text style={[styles.feedbackText, { color: colors.warning }]}>{warning}</Text>
            </View>
          ) : null}
          {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontSize: 15 },
  errorState: { width: '100%', gap: Spacing.lg },
  errorTitle: { fontSize: 25, fontWeight: '800' },
  errorText: { fontSize: 15, lineHeight: 22 },
  content: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.xl },
  intro: { gap: Spacing.sm },
  title: { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  section: { gap: Spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  sectionSubtitle: { marginTop: -Spacing.md, fontSize: 14, lineHeight: 20 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  infoIcon: { fontSize: 20 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  feedback: { padding: Spacing.md, borderRadius: Radius.sm },
  feedbackText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
