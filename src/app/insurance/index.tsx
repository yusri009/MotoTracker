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
import { InsuranceHistory } from '@/components/documents/InsuranceHistory';
import { FormInput } from '@/components/ui/FormInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { Vehicle, VehicleDocument } from '@/models';
import { insuranceService } from '@/services/insuranceService';
import { IS_EXPO_GO } from '@/services/notificationService';
import { formatLocalDate, isValidDateOnly } from '@/utils/date';
import { calculateDateExpiry, formatDocumentDate } from '@/utils/maintenance';

interface InsuranceForm {
  provider: string;
  policyNumber: string;
  startDate: string;
  expiryDate: string;
  cost: string;
}

type FieldErrors = Partial<Record<keyof InsuranceForm, string>>;

const emptyForm: InsuranceForm = {
  provider: '',
  policyNumber: '',
  startDate: formatLocalDate(),
  expiryDate: '',
  cost: '',
};

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Insurance information could not be saved.';
}

function policyToForm(policy: VehicleDocument): InsuranceForm {
  return {
    provider: policy.provider ?? '',
    policyNumber: policy.policyNumber ?? '',
    startDate: policy.startDate,
    expiryDate: policy.expiryDate,
    cost: policy.cost == null ? '' : String(policy.cost),
  };
}

export default function InsuranceScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activePolicy, setActivePolicy] = useState<VehicleDocument | null>(null);
  const [history, setHistory] = useState<VehicleDocument[]>([]);
  const [form, setForm] = useState<InsuranceForm>(emptyForm);
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
      const insuranceData = savedVehicle ? await insuranceService.load(savedVehicle.id) : null;

      if (!active) {
        return;
      }

      setVehicle(savedVehicle);
      setActivePolicy(insuranceData?.activePolicy ?? null);
      setHistory(insuranceData?.history ?? []);
      setForm(
        insuranceData?.activePolicy ? policyToForm(insuranceData.activePolicy) : emptyForm,
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
    () => (activePolicy ? calculateDateExpiry(activePolicy.expiryDate) : null),
    [activePolicy],
  );

  function updateField(field: keyof InsuranceForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
    setSuccessMessage(null);
    setReminderWarning(null);
  }

  function validateForm() {
    const errors: FieldErrors = {};
    const provider = form.provider.trim();
    const policyNumber = form.policyNumber.trim();
    const costText = form.cost.trim();
    const cost = costText === '' ? null : Number(costText);

    if (!provider) {
      errors.provider = 'Enter the insurance company name.';
    }
    if (!policyNumber) {
      errors.policyNumber = 'Enter the policy number.';
    }
    if (!isValidDateOnly(form.startDate)) {
      errors.startDate = 'Use a valid date in YYYY-MM-DD format.';
    }
    if (!isValidDateOnly(form.expiryDate)) {
      errors.expiryDate = 'Use a valid date in YYYY-MM-DD format.';
    } else if (isValidDateOnly(form.startDate) && form.expiryDate < form.startDate) {
      errors.expiryDate = 'Expiry date cannot be before the start date.';
    }
    if (
      costText !== '' &&
      (!/^\d+(\.\d{1,2})?$/.test(costText) || !Number.isFinite(cost) || Number(cost) < 0)
    ) {
      errors.cost = 'Enter a non-negative amount with up to two decimal places.';
    }

    setFieldErrors(errors);

    return Object.keys(errors).length > 0
      ? null
      : { provider, policyNumber, cost };
  }

  function confirmSave() {
    const values = validateForm();
    if (!values || saving) {
      return;
    }

    if (!activePolicy) {
      void savePolicy(values);
      return;
    }

    Alert.alert(
      'Save this policy?',
      'The current policy will remain in history and these details will become the active policy.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save policy', onPress: () => void savePolicy(values) },
      ],
    );
  }

  async function savePolicy(values: {
    provider: string;
    policyNumber: string;
    cost: number | null;
  }) {
    if (!vehicle) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSuccessMessage(null);
    setReminderWarning(null);

    try {
      const result = await insuranceService.save({
        vehicleId: vehicle.id,
        provider: values.provider,
        policyNumber: values.policyNumber,
        startDate: form.startDate,
        expiryDate: form.expiryDate,
        cost: values.cost,
      });

      setActivePolicy(result.activePolicy);
      setHistory(result.history);
      setForm(policyToForm(result.activePolicy));
      setFieldErrors({});
      setSuccessMessage(
        `Insurance saved. Current policy expires ${formatDocumentDate(result.activePolicy.expiryDate)}.`,
      );

      if (result.reminderResult.status === 'scheduled') {
        const count = result.reminderResult.scheduledCount;
        setSuccessMessage(
          `Insurance saved. ${count} local ${count === 1 ? 'reminder' : 'reminders'} scheduled.`,
        );
      } else if (result.reminderResult.status === 'denied') {
        setReminderWarning('Insurance was saved, but notifications are disabled. Allow notifications in Android settings to receive expiry alerts.');
      } else if (result.reminderResult.status === 'development_build_required') {
        setReminderWarning('Insurance was saved. Expo Go cannot schedule notifications for this project; use a development or production build to enable expiry alerts.');
      } else if (result.reminderResult.status === 'unavailable') {
        setReminderWarning('Insurance was saved, but local reminders could not be scheduled on this device.');
      } else {
        setReminderWarning('Insurance was saved. All standard reminder dates for this expiry have already passed.');
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
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading insurance details…</Text>
      </SafeAreaView>
    );
  }

  if (screenState === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Insurance tracking unavailable</Text>
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
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Create a vehicle before adding insurance details.</Text>
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
            <Text style={[styles.title, { color: colors.text }]}>Vehicle insurance</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Keep the active policy, expiry status, and renewal history available offline.</Text>
          </View>

          <ExpiryCard
            title="Insurance"
            icon="🛡️"
            expiryDate={activePolicy?.expiryDate ?? null}
            calculation={expiryCalculation}
          />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Policy details</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Saving new details archives the current policy in history.</Text>
            <FormInput
              label="Insurance company"
              placeholder="Company name"
              value={form.provider}
              error={fieldErrors.provider}
              autoCapitalize="words"
              onChangeText={(value) => updateField('provider', value)}
            />
            <FormInput
              label="Policy number"
              placeholder="Policy number"
              value={form.policyNumber}
              error={fieldErrors.policyNumber}
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={(value) => updateField('policyNumber', value)}
            />
            <FormInput
              label="Start date"
              placeholder="YYYY-MM-DD"
              value={form.startDate}
              error={fieldErrors.startDate}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateField('startDate', value)}
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
              label="Premium / cost"
              placeholder="Optional"
              value={form.cost}
              error={fieldErrors.cost}
              keyboardType="decimal-pad"
              onChangeText={(value) => updateField('cost', value)}
            />
            <PrimaryButton
              title={activePolicy ? 'Save updated / renewed policy' : 'Save insurance policy'}
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
                  ? 'Insurance tracking works in Expo Go. Notification scheduling becomes available in a development or production build.'
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Policy history</Text>
              <Text style={[styles.historyCount, { color: colors.textMuted }]}>{history.length}</Text>
            </View>
            <InsuranceHistory policies={history} />
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
