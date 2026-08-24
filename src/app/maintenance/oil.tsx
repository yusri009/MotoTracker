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

import { MaintenanceCard } from '@/components/dashboard/MaintenanceCard';
import { OilChangeHistory } from '@/components/maintenance/OilChangeHistory';
import { FormInput } from '@/components/ui/FormInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { MaintenanceRecord, MaintenanceSetting, Vehicle } from '@/models';
import { oilService } from '@/services/oilService';
import { formatLocalDate, isValidDateOnly } from '@/utils/date';
import { calculateKmMaintenance, formatKilometres } from '@/utils/maintenance';

interface OilForm {
  lastServiceOdometer: string;
  intervalKm: string;
  lastServiceDate: string;
  dueSoonThresholdKm: string;
  productName: string;
  cost: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof OilForm, string>>;
type SavingAction = 'settings' | 'changed' | null;

interface SharedValues {
  intervalKm: number;
  dueSoonThresholdKm: number;
  cost: number | null;
}

const emptyForm: OilForm = {
  lastServiceOdometer: '',
  intervalKm: '',
  lastServiceDate: formatLocalDate(),
  dueSoonThresholdKm: '300',
  productName: '',
  cost: '',
  notes: '',
};

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Engine-oil information could not be saved.';
}

function parseWholeNumber(value: string, allowZero: boolean) {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  const minimumIsValid = allowZero ? parsed >= 0 : parsed > 0;
  return /^\d+$/.test(trimmed) && Number.isSafeInteger(parsed) && minimumIsValid
    ? parsed
    : null;
}

function parseOptionalCost(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return /^\d+(\.\d{1,2})?$/.test(trimmed) && Number.isFinite(parsed) ? parsed : undefined;
}

export default function OilScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [setting, setSetting] = useState<MaintenanceSetting | null>(null);
  const [history, setHistory] = useState<MaintenanceRecord[]>([]);
  const [form, setForm] = useState<OilForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [screenState, setScreenState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<SavingAction>(null);
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
      const oilData = savedVehicle ? await oilService.load(savedVehicle.id) : null;

      if (!active) {
        return;
      }

      setVehicle(savedVehicle);
      setSetting(oilData?.setting ?? null);
      setHistory(oilData?.history ?? []);

      if (oilData?.setting) {
        setForm({
          lastServiceOdometer: String(oilData.setting.lastServiceOdometer),
          intervalKm: String(oilData.setting.intervalKm),
          lastServiceDate: oilData.setting.lastServiceDate,
          dueSoonThresholdKm: String(oilData.setting.dueSoonThresholdKm),
          productName: oilData.setting.productName ?? '',
          cost:
            oilData.setting.lastServiceCost == null
              ? ''
              : String(oilData.setting.lastServiceCost),
          notes: '',
        });
      }

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

  const calculation = useMemo(
    () =>
      setting && vehicle
        ? calculateKmMaintenance(
            vehicle.currentOdometer,
            setting.lastServiceOdometer,
            setting.intervalKm,
            setting.dueSoonThresholdKm,
          )
        : null,
    [setting, vehicle],
  );

  function updateField(field: keyof OilForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
    setSuccessMessage(null);
  }

  function validateSharedValues(): SharedValues | null {
    const errors: FieldErrors = {};
    const intervalKm = parseWholeNumber(form.intervalKm, false);
    const dueSoonThresholdKm = parseWholeNumber(form.dueSoonThresholdKm, true);
    const cost = parseOptionalCost(form.cost);

    if (intervalKm == null) {
      errors.intervalKm = 'Enter a positive whole-number interval.';
    }
    if (dueSoonThresholdKm == null) {
      errors.dueSoonThresholdKm = 'Enter zero or a positive whole number.';
    }
    if (cost === undefined) {
      errors.cost = 'Enter a valid non-negative cost with up to 2 decimal places.';
    }

    setFieldErrors((current) => ({ ...current, ...errors }));

    if (intervalKm == null || dueSoonThresholdKm == null || cost === undefined) {
      return null;
    }

    return { intervalKm, dueSoonThresholdKm, cost };
  }

  function validateConfiguration() {
    const shared = validateSharedValues();
    const errors: FieldErrors = {};
    const lastServiceOdometer = parseWholeNumber(form.lastServiceOdometer, true);
    const today = formatLocalDate();

    if (lastServiceOdometer == null) {
      errors.lastServiceOdometer = 'Enter a non-negative whole-number reading.';
    } else if (vehicle && lastServiceOdometer > vehicle.currentOdometer) {
      errors.lastServiceOdometer = `Reading cannot exceed ${formatKilometres(vehicle.currentOdometer)} km.`;
    }

    if (!isValidDateOnly(form.lastServiceDate)) {
      errors.lastServiceDate = 'Use a valid date in YYYY-MM-DD format.';
    } else if (form.lastServiceDate > today) {
      errors.lastServiceDate = 'Last oil-change date cannot be in the future.';
    }

    setFieldErrors((current) => ({ ...current, ...errors }));

    if (!shared || lastServiceOdometer == null || Object.keys(errors).length > 0) {
      return null;
    }

    return { ...shared, lastServiceOdometer };
  }

  async function saveSettings() {
    if (!vehicle || savingAction) {
      return;
    }

    const values = validateConfiguration();
    if (!values) {
      return;
    }

    setSavingAction('settings');
    setSaveError(null);
    setSuccessMessage(null);

    try {
      const savedSetting = await oilService.saveConfiguration({
        vehicleId: vehicle.id,
        lastServiceOdometer: values.lastServiceOdometer,
        intervalKm: values.intervalKm,
        lastServiceDate: form.lastServiceDate,
        dueSoonThresholdKm: values.dueSoonThresholdKm,
        productName: form.productName,
        cost: values.cost,
      });
      setSetting(savedSetting);
      setFieldErrors({});
      setSuccessMessage('Engine-oil reminder settings saved.');
    } catch (reason: unknown) {
      setSaveError(getErrorMessage(reason));
    } finally {
      setSavingAction(null);
    }
  }

  function confirmOilChanged() {
    if (!vehicle || savingAction) {
      return;
    }

    const values = validateSharedValues();
    if (!values) {
      return;
    }

    Alert.alert(
      'Mark oil changed?',
      `Record an oil change today at ${formatKilometres(vehicle.currentOdometer)} km?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark changed',
          onPress: () => {
            void markOilChanged(values);
          },
        },
      ],
    );
  }

  async function markOilChanged(values: SharedValues) {
    if (!vehicle) {
      return;
    }

    setSavingAction('changed');
    setSaveError(null);
    setSuccessMessage(null);

    try {
      const result = await oilService.markChanged({
        vehicleId: vehicle.id,
        intervalKm: values.intervalKm,
        dueSoonThresholdKm: values.dueSoonThresholdKm,
        productName: form.productName,
        cost: values.cost,
        notes: form.notes,
      });
      setSetting(result.setting);
      setHistory((current) => [result.record, ...current]);
      setFieldErrors({});
      setForm((current) => ({
        ...current,
        lastServiceOdometer: String(result.setting.lastServiceOdometer),
        lastServiceDate: result.setting.lastServiceDate,
        notes: '',
      }));
      setSuccessMessage(
        `Oil change recorded. Next change is at ${formatKilometres(
          result.setting.lastServiceOdometer + result.setting.intervalKm,
        )} km.`,
      );
    } catch (reason: unknown) {
      setSaveError(getErrorMessage(reason));
    } finally {
      setSavingAction(null);
    }
  }

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading engine-oil details…</Text>
      </SafeAreaView>
    );
  }

  if (screenState === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Engine-oil tracking unavailable</Text>
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
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Create a vehicle before configuring oil reminders.</Text>
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
            <Text style={[styles.title, { color: colors.text }]}>Engine oil</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track oil changes by odometer distance and record completed changes in maintenance history.</Text>
          </View>

          <MaintenanceCard title="Engine oil" icon="🛢️" calculation={calculation} />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Reminder settings</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Use these fields to describe the most recent known oil change.</Text>

            <FormInput
              label="Last oil change odometer"
              placeholder={`Up to ${formatKilometres(vehicle.currentOdometer)}`}
              value={form.lastServiceOdometer}
              error={fieldErrors.lastServiceOdometer}
              keyboardType="number-pad"
              onChangeText={(value) => updateField('lastServiceOdometer', value)}
            />
            <FormInput
              label="Date of last oil change"
              placeholder="YYYY-MM-DD"
              value={form.lastServiceDate}
              error={fieldErrors.lastServiceDate}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateField('lastServiceDate', value)}
            />
            <FormInput
              label="Oil change interval (km)"
              placeholder="3000"
              value={form.intervalKm}
              error={fieldErrors.intervalKm}
              keyboardType="number-pad"
              onChangeText={(value) => updateField('intervalKm', value)}
            />
            <FormInput
              label="Due-soon threshold (km)"
              placeholder="300"
              value={form.dueSoonThresholdKm}
              error={fieldErrors.dueSoonThresholdKm}
              hint="The dashboard warns you within this distance."
              keyboardType="number-pad"
              onChangeText={(value) => updateField('dueSoonThresholdKm', value)}
            />
            <FormInput
              label="Oil type or brand"
              placeholder="10W-40 · Motul"
              value={form.productName}
              hint="Optional"
              autoCapitalize="words"
              onChangeText={(value) => updateField('productName', value)}
            />
            <FormInput
              label="Cost"
              placeholder="4500"
              value={form.cost}
              error={fieldErrors.cost}
              hint="Optional"
              keyboardType="decimal-pad"
              onChangeText={(value) => updateField('cost', value)}
            />

            <PrimaryButton
              title="Save reminder settings"
              variant="secondary"
              loading={savingAction === 'settings'}
              disabled={savingAction !== null}
              onPress={() => void saveSettings()}
            />
          </View>

          <View
            style={[
              styles.completionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.completionHeading}>
              <Text style={styles.completionIcon}>✓</Text>
              <View style={styles.completionCopy}>
                <Text style={[styles.completionTitle, { color: colors.text }]}>Changed the oil now?</Text>
                <Text style={[styles.completionText, { color: colors.textMuted }]}>This records today’s change at {formatKilometres(vehicle.currentOdometer)} km and resets the reminder.</Text>
              </View>
            </View>
            <FormInput
              label="Notes"
              placeholder="Filter changed, workshop name…"
              value={form.notes}
              hint="Optional · saved only with the history record"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.notesInput}
              onChangeText={(value) => updateField('notes', value)}
            />
            <PrimaryButton
              title="Mark Oil Changed"
              loading={savingAction === 'changed'}
              disabled={savingAction !== null}
              onPress={confirmOilChanged}
            />
          </View>

          {successMessage ? (
            <View style={[styles.feedback, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.feedbackText, { color: colors.success }]}>{successMessage}</Text>
            </View>
          ) : null}
          {saveError ? <Text style={[styles.saveError, { color: colors.danger }]}>{saveError}</Text> : null}

          <View style={styles.section}>
            <View style={styles.historyHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Oil-change history</Text>
              <Text style={[styles.historyCount, { color: colors.textMuted }]}>{history.length}</Text>
            </View>
            <OilChangeHistory records={history} />
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
  sectionTitle: { fontSize: 21, fontWeight: '800' },
  sectionSubtitle: { marginTop: -Spacing.md, fontSize: 14, lineHeight: 20 },
  completionCard: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  completionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  completionIcon: {
    width: 32,
    height: 32,
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '800',
  },
  completionCopy: { flex: 1, gap: Spacing.xs },
  completionTitle: { fontSize: 18, fontWeight: '800' },
  completionText: { fontSize: 14, lineHeight: 20 },
  notesInput: { minHeight: 96, paddingTop: Spacing.md },
  feedback: { padding: Spacing.md, borderRadius: Radius.sm },
  feedbackText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  saveError: { fontSize: 14, lineHeight: 20 },
  historyHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  historyCount: { fontSize: 13 },
});
