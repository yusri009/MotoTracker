import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpiryCard } from '@/components/dashboard/ExpiryCard';
import { RevenueLicenceHistory } from '@/components/documents/RevenueLicenceHistory';
import { FormInput } from '@/components/ui/FormInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { Vehicle, VehicleDocument } from '@/models';
import { IS_EXPO_GO } from '@/services/notificationService';
import { revenueLicenceService } from '@/services/revenueLicenceService';
import { formatLocalDate, isValidDateOnly } from '@/utils/date';
import { calculateDateExpiry, formatDocumentDate } from '@/utils/maintenance';

interface LicenceForm {
  issueDate: string;
  expiryDate: string;
  cost: string;
}

type FieldErrors = Partial<Record<keyof LicenceForm, string>>;

const emptyForm: LicenceForm = {
  issueDate: formatLocalDate(),
  expiryDate: '',
  cost: '',
};

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Revenue licence information could not be saved.';
}

function licenceToForm(licence: VehicleDocument): LicenceForm {
  return {
    issueDate: licence.startDate,
    expiryDate: licence.expiryDate,
    cost: licence.cost == null ? '' : String(licence.cost),
  };
}

export default function RevenueLicenceScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activeLicence, setActiveLicence] = useState<VehicleDocument | null>(null);
  const [history, setHistory] = useState<VehicleDocument[]>([]);
  const [form, setForm] = useState<LicenceForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [screenState, setScreenState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reminderWarning, setReminderWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (database.state === 'initializing') {
      setScreenState('loading');
      return;
    }

    if (database.state === 'error') {
      setLoadError(database.error);
      setScreenState('error');
      return;
    }

    let active = true;
    setScreenState('loading');
    setLoadError(null);

    void (async () => {
      const savedVehicle = await vehicleRepository.getPrimary();
      const licenceData = savedVehicle
        ? await revenueLicenceService.load(savedVehicle.id)
        : null;

      if (!active) {
        return;
      }

      setVehicle(savedVehicle);
      setActiveLicence(licenceData?.activeLicence ?? null);
      setHistory(licenceData?.history ?? []);
      setForm(
        licenceData?.activeLicence ? licenceToForm(licenceData.activeLicence) : emptyForm,
      );
      setScreenState('ready');
    })().catch((reason: unknown) => {
      if (active) {
        setLoadError(getErrorMessage(reason));
        setScreenState('error');
      }
    });

    return () => {
      active = false;
    };
  }, [database.error, database.state, reloadKey]);

  const expiryCalculation = useMemo(
    () => (activeLicence ? calculateDateExpiry(activeLicence.expiryDate) : null),
    [activeLicence],
  );

  function updateField(field: keyof LicenceForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
    setSuccessMessage(null);
    setReminderWarning(null);
  }

  function validateForm() {
    const errors: FieldErrors = {};
    const costText = form.cost.trim();
    const cost = costText === '' ? null : Number(costText);

    if (!isValidDateOnly(form.issueDate)) {
      errors.issueDate = 'Use a valid date in YYYY-MM-DD format.';
    }
    if (!isValidDateOnly(form.expiryDate)) {
      errors.expiryDate = 'Use a valid date in YYYY-MM-DD format.';
    } else if (isValidDateOnly(form.issueDate) && form.expiryDate < form.issueDate) {
      errors.expiryDate = 'Expiry date cannot be before the issue date.';
    }
    if (
      costText !== '' &&
      (!/^\d+(\.\d{1,2})?$/.test(costText) || !Number.isFinite(cost) || Number(cost) < 0)
    ) {
      errors.cost = 'Enter a non-negative amount with up to two decimal places.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length > 0 ? null : { cost };
  }

  function confirmSave() {
    const values = validateForm();
    if (!values || saving) {
      return;
    }

    if (!activeLicence) {
      void saveLicence(values.cost);
      return;
    }

    Alert.alert(
      'Save this revenue licence?',
      'The current licence will remain in history and these details will become active.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save licence', onPress: () => void saveLicence(values.cost) },
      ],
    );
  }

  async function saveLicence(cost: number | null) {
    if (!vehicle) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSuccessMessage(null);
    setReminderWarning(null);

    try {
      const result = await revenueLicenceService.save({
        vehicleId: vehicle.id,
        startDate: form.issueDate,
        expiryDate: form.expiryDate,
        cost,
      });

      setActiveLicence(result.activeLicence);
      setHistory(result.history);
      setForm(licenceToForm(result.activeLicence));
      setFieldErrors({});
      setSuccessMessage(
        `Revenue licence saved. It expires ${formatDocumentDate(result.activeLicence.expiryDate)}.`,
      );

      if (result.reminderResult.status === 'scheduled') {
        const count = result.reminderResult.scheduledCount;
        setSuccessMessage(
          `Revenue licence saved. ${count} local ${count === 1 ? 'reminder' : 'reminders'} scheduled.`,
        );
      } else if (result.reminderResult.status === 'denied') {
        setReminderWarning('Revenue licence was saved, but notifications are disabled. Allow notifications in Android settings to receive expiry alerts.');
      } else if (result.reminderResult.status === 'development_build_required') {
        setReminderWarning('Revenue licence was saved. Expo Go cannot schedule notifications for this project; use a development or production build to enable expiry alerts.');
      } else if (result.reminderResult.status === 'unavailable') {
        setReminderWarning('Revenue licence was saved, but local reminders could not be scheduled on this device.');
      } else {
        setReminderWarning('Revenue licence was saved. All standard reminder dates for this expiry have already passed.');
      }
    } catch (reason: unknown) {
      setSaveError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading revenue licence…</Text>
      </SafeAreaView>
    );
  }

  if (screenState === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Licence tracking unavailable</Text>
          <Text style={[styles.errorText, { color: colors.danger }]}>{loadError}</Text>
          <PrimaryButton
            title="Try again"
            onPress={() => {
              if (database.state === 'error') database.retry();
              else setReloadKey((value) => value + 1);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>No vehicle profile</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Create a vehicle before adding revenue licence details.</Text>
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
            <Text style={[styles.title, { color: colors.text }]}>Revenue licence</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track the active licence, expiry status, cost, and renewal history offline.</Text>
          </View>

          <ExpiryCard
            title="Revenue licence"
            icon="📄"
            expiryDate={activeLicence?.expiryDate ?? null}
            calculation={expiryCalculation}
          />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Licence details</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Saving new details archives the current licence in history.</Text>
            <FormInput
              label="Issue date"
              placeholder="YYYY-MM-DD"
              value={form.issueDate}
              error={fieldErrors.issueDate}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateField('issueDate', value)}
            />
            <FormInput
              label="Expiry date"
              placeholder="YYYY-MM-DD"
              value={form.expiryDate}
              error={fieldErrors.expiryDate}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateField('expiryDate', value)}
            />
            <FormInput
              label="Licence cost"
              placeholder="Optional"
              value={form.cost}
              error={fieldErrors.cost}
              keyboardType="decimal-pad"
              onChangeText={(value) => updateField('cost', value)}
            />
            <PrimaryButton
              title={activeLicence ? 'Save updated / renewed licence' : 'Save revenue licence'}
              loading={saving}
              onPress={confirmSave}
            />
          </View>

          <View
            style={[
              styles.reminderCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={styles.reminderIcon}>🔔</Text>
            <View style={styles.reminderCopy}>
              <Text style={[styles.reminderTitle, { color: colors.text }]}>Automatic local reminders</Text>
              <Text style={[styles.reminderText, { color: colors.textMuted }]}>
                {IS_EXPO_GO
                  ? 'Revenue licence tracking works in Expo Go. Notification scheduling becomes available in a development or production build.'
                  : 'MotoTracker schedules alerts at 30, 14, 7, and 1 day before expiry. Allow notification permission when Android asks.'}
              </Text>
            </View>
          </View>

          {successMessage ? (
            <View style={[styles.feedback, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.feedbackText, { color: colors.success }]}>{successMessage}</Text>
            </View>
          ) : null}
          {reminderWarning ? (
            <View style={[styles.feedback, { backgroundColor: colors.warningSoft }]}>
              <Text style={[styles.feedbackText, { color: colors.warning }]}>{reminderWarning}</Text>
            </View>
          ) : null}
          {saveError ? <Text style={[styles.saveError, { color: colors.danger }]}>{saveError}</Text> : null}

          <View style={styles.section}>
            <View style={styles.historyHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Licence history</Text>
              <Text style={[styles.historyCount, { color: colors.textMuted }]}>{history.length}</Text>
            </View>
            <RevenueLicenceHistory licences={history} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: { fontSize: 15 },
  errorState: { width: '100%', gap: Spacing.lg },
  errorTitle: { fontSize: 25, fontWeight: '800' },
  errorText: { fontSize: 15, lineHeight: 22 },
  content: {
    padding: Spacing.lg,
    paddingBottom: 48,
    gap: Spacing.xl,
  },
  intro: { gap: Spacing.sm },
  title: { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  section: { gap: Spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  sectionSubtitle: { marginTop: -Spacing.md, fontSize: 14, lineHeight: 20 },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  reminderIcon: { fontSize: 22 },
  reminderCopy: { flex: 1, gap: Spacing.xs },
  reminderTitle: { fontSize: 16, fontWeight: '800' },
  reminderText: { fontSize: 14, lineHeight: 20 },
  feedback: {
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  feedbackText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  saveError: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  historyHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyCount: { fontSize: 13, fontWeight: '700' },
});
