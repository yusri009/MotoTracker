import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MaintenanceHistory,
  MAINTENANCE_TYPE_COPY,
} from '@/components/maintenance/MaintenanceHistory';
import { FormInput } from '@/components/ui/FormInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { maintenanceRepository, vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import {
  MAINTENANCE_TYPES,
  type MaintenanceRecord,
  type MaintenanceType,
  type Vehicle,
} from '@/models';
import { formatLocalDate, isValidDateOnly } from '@/utils/date';
import { formatKilometres } from '@/utils/maintenance';

interface EventForm {
  type: MaintenanceType;
  servicedAt: string;
  odometer: string;
  cost: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof EventForm, string>>;

function createEmptyForm(vehicle: Vehicle): EventForm {
  return {
    type: 'SERVICE',
    servicedAt: formatLocalDate(),
    odometer: String(vehicle.currentOdometer),
    cost: '',
    notes: '',
  };
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Maintenance event could not be saved.';
}

export default function MaintenanceHistoryScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [form, setForm] = useState<EventForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [screenState, setScreenState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      const savedRecords = savedVehicle
        ? await maintenanceRepository.listRecords(savedVehicle.id)
        : [];

      if (!active) return;
      setVehicle(savedVehicle);
      setRecords(savedRecords);
      setForm(savedVehicle ? createEmptyForm(savedVehicle) : null);
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

  function updateField<K extends keyof EventForm>(field: K, value: EventForm[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
    setSuccess(null);
  }

  function validateForm() {
    if (!form || !vehicle) return null;

    const errors: FieldErrors = {};
    const odometerText = form.odometer.trim();
    const odometer = Number(odometerText);
    const costText = form.cost.trim();
    const cost = costText === '' ? null : Number(costText);

    if (!/^\d+$/.test(odometerText) || !Number.isSafeInteger(odometer)) {
      errors.odometer = 'Enter a non-negative whole-number reading.';
    } else if (odometer > vehicle.currentOdometer) {
      errors.odometer = `Reading cannot exceed ${formatKilometres(vehicle.currentOdometer)} km.`;
    }
    if (!isValidDateOnly(form.servicedAt)) {
      errors.servicedAt = 'Use a valid date in YYYY-MM-DD format.';
    } else if (form.servicedAt > formatLocalDate()) {
      errors.servicedAt = 'Maintenance date cannot be in the future.';
    }
    if (
      costText !== '' &&
      (!/^\d+(\.\d{1,2})?$/.test(costText) || !Number.isFinite(cost) || Number(cost) < 0)
    ) {
      errors.cost = 'Enter a non-negative amount with up to two decimal places.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length > 0 ? null : { odometer, cost };
  }

  async function saveEvent() {
    const values = validateForm();
    if (!values || !vehicle || !form || saving) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const record = await maintenanceRepository.addRecord({
        vehicleId: vehicle.id,
        type: form.type,
        servicedAt: form.servicedAt,
        odometer: values.odometer,
        cost: values.cost,
        notes: form.notes,
      });
      const nextRecords = await maintenanceRepository.listRecords(vehicle.id);
      setRecords(nextRecords);
      setForm(createEmptyForm(vehicle));
      setFieldErrors({});
      setSuccess(`${MAINTENANCE_TYPE_COPY[record.type].label} added to history.`);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading maintenance history…</Text>
      </SafeAreaView>
    );
  }

  if (screenState === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>History unavailable</Text>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <PrimaryButton title="Try again" onPress={() => setReloadKey((value) => value + 1)} />
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle || !form) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>No vehicle profile</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Create a vehicle before recording maintenance.</Text>
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
            <Text style={[styles.title, { color: colors.text }]}>Maintenance history</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>All completed work for {vehicle.name}, newest first.</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Add maintenance event</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Use the dedicated oil and chain screens when you also want to reset those reminders.</Text>
            <View style={styles.typeGrid}>
              {MAINTENANCE_TYPES.map((type) => {
                const selected = form.type === type;
                const copy = MAINTENANCE_TYPE_COPY[type];
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => updateField('type', type)}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor: selected ? colors.accentSoft : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={styles.typeIcon}>{copy.icon}</Text>
                    <Text style={[styles.typeText, { color: selected ? colors.primary : colors.text }]}>{copy.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <FormInput
              label="Maintenance date"
              placeholder="YYYY-MM-DD"
              value={form.servicedAt}
              error={fieldErrors.servicedAt}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => updateField('servicedAt', value)}
            />
            <FormInput
              label="Odometer"
              placeholder={`Up to ${formatKilometres(vehicle.currentOdometer)}`}
              value={form.odometer}
              error={fieldErrors.odometer}
              keyboardType="number-pad"
              onChangeText={(value) => updateField('odometer', value)}
            />
            <FormInput
              label="Cost"
              placeholder="Optional"
              value={form.cost}
              error={fieldErrors.cost}
              keyboardType="decimal-pad"
              onChangeText={(value) => updateField('cost', value)}
            />
            <FormInput
              label="Notes"
              placeholder="Work completed, parts used, workshop…"
              value={form.notes}
              hint="Optional"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.notesInput}
              onChangeText={(value) => updateField('notes', value)}
            />
            <PrimaryButton title="Add to maintenance history" loading={saving} onPress={() => void saveEvent()} />
          </View>

          {success ? (
            <View style={[styles.feedback, { backgroundColor: colors.successSoft }]}>
              <Text style={[styles.feedbackText, { color: colors.success }]}>{success}</Text>
            </View>
          ) : null}
          {error ? <Text style={[styles.saveError, { color: colors.danger }]}>{error}</Text> : null}

          <View style={styles.section}>
            <View style={styles.historyHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>All records</Text>
              <Text style={[styles.historyCount, { color: colors.textMuted }]}>{records.length}</Text>
            </View>
            <MaintenanceHistory records={records} />
          </View>
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeButton: {
    width: '48%',
    minHeight: 72,
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  typeIcon: { fontSize: 19 },
  typeText: { fontSize: 13, fontWeight: '700' },
  notesInput: { minHeight: 96, paddingTop: Spacing.md },
  feedback: { padding: Spacing.md, borderRadius: Radius.sm },
  feedbackText: { fontSize: 14, fontWeight: '600' },
  saveError: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyCount: { fontSize: 13, fontWeight: '700' },
});
