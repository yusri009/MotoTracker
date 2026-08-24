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

import { OdometerHistory } from '@/components/odometer/OdometerHistory';
import { FormInput } from '@/components/ui/FormInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { odometerRepository, vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { OdometerHistoryEntry, Vehicle } from '@/models';
import { formatKilometres } from '@/utils/maintenance';

type ScreenState = 'loading' | 'ready' | 'error';

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'The odometer could not be updated.';
}

export default function OdometerUpdateScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<OdometerHistoryEntry[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [odometer, setOdometer] = useState('');
  const [note, setNote] = useState('');
  const [odometerError, setOdometerError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (database.state === 'initializing') {
      setScreenState('loading');
      return;
    }

    if (database.state === 'error') {
      setScreenState('error');
      setLoadError(database.error);
      return;
    }

    let active = true;
    setScreenState('loading');
    setLoadError(null);

    void (async () => {
      const savedVehicle = await vehicleRepository.getPrimary();
      const savedHistory = savedVehicle
        ? await odometerRepository.listForVehicle(savedVehicle.id)
        : [];

      if (active) {
        setVehicle(savedVehicle);
        setHistory(savedHistory);
        setScreenState('ready');
      }
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

  function validateReading() {
    const trimmed = odometer.trim();
    const value = Number(trimmed);

    if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(value)) {
      setOdometerError('Enter a non-negative whole number.');
      return null;
    }

    if (vehicle && value < vehicle.currentOdometer) {
      setOdometerError(
        `Reading cannot be lower than ${formatKilometres(vehicle.currentOdometer)} km.`,
      );
      return null;
    }

    setOdometerError(null);
    return value;
  }

  async function saveReading() {
    if (!vehicle || saving) {
      return;
    }

    const value = validateReading();
    if (value == null) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    try {
      const entry = await odometerRepository.add({
        vehicleId: vehicle.id,
        odometer: value,
        note,
      });

      setVehicle((current) =>
        current ? { ...current, currentOdometer: entry.odometer, updatedAt: entry.createdAt } : current,
      );
      setHistory((current) => [entry, ...current]);
      setOdometer('');
      setNote('');
      setSuccessMessage(`Odometer updated to ${formatKilometres(entry.odometer)} km.`);
    } catch (reason: unknown) {
      setSaveError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading odometer history…</Text>
      </SafeAreaView>
    );
  }

  if (screenState === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.errorState}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Odometer unavailable</Text>
          <Text style={[styles.errorText, { color: colors.danger }]}>{loadError}</Text>
          <PrimaryButton
            title="Try again"
            onPress={() => {
              if (database.state === 'error') {
                database.retry();
              } else {
                setReloadKey((value) => value + 1);
              }
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
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Create a vehicle before recording mileage.</Text>
          <PrimaryButton title="Go home" onPress={() => router.replace('/' as Href)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={[styles.title, { color: colors.text }]}>Update odometer</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>A higher reading automatically refreshes distance-based maintenance reminders.</Text>
          </View>

          <View
            style={[
              styles.currentCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.currentIconWrap}>
              <Text style={styles.currentIcon}>🛣️</Text>
            </View>
            <View style={styles.currentCopy}>
              <Text style={[styles.currentLabel, { color: colors.textMuted }]}>CURRENT READING</Text>
              <Text style={[styles.currentValue, { color: colors.text }]}>
                {formatKilometres(vehicle.currentOdometer)} <Text style={styles.currentUnit}>km</Text>
              </Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>New reading</Text>
            <FormInput
              label="Odometer (km)"
              placeholder={`At least ${formatKilometres(vehicle.currentOdometer)}`}
              value={odometer}
              error={odometerError ?? undefined}
              keyboardType="number-pad"
              returnKeyType="next"
              onChangeText={(value) => {
                setOdometer(value);
                setOdometerError(null);
                setSaveError(null);
                setSuccessMessage(null);
              }}
            />
            <FormInput
              label="Note"
              placeholder="Fuel stop, trip, service visit…"
              value={note}
              hint="Optional"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.noteInput}
              onChangeText={(value) => {
                setNote(value);
                setSaveError(null);
                setSuccessMessage(null);
              }}
            />

            {successMessage ? (
              <View style={[styles.feedback, { backgroundColor: colors.successSoft }]}>
                <Text style={[styles.feedbackText, { color: colors.success }]}>{successMessage}</Text>
              </View>
            ) : null}
            {saveError ? <Text style={[styles.saveError, { color: colors.danger }]}>{saveError}</Text> : null}

            <PrimaryButton
              title="Save reading"
              loading={saving}
              onPress={() => void saveReading()}
            />
          </View>

          <View style={styles.historySection}>
            <View style={styles.historyHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>History</Text>
              <Text style={[styles.historyCount, { color: colors.textMuted }]}>
                {history.length} {history.length === 1 ? 'reading' : 'readings'}
              </Text>
            </View>
            <OdometerHistory entries={history} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    fontSize: 15,
  },
  errorState: {
    width: '100%',
    gap: Spacing.lg,
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 48,
    gap: Spacing.xl,
  },
  intro: {
    gap: Spacing.sm,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  currentIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentIcon: {
    fontSize: 28,
  },
  currentCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  currentValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  currentUnit: {
    fontSize: 16,
    fontWeight: '600',
  },
  formSection: {
    gap: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  noteInput: {
    minHeight: 96,
    paddingTop: Spacing.md,
  },
  feedback: {
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  saveError: {
    fontSize: 14,
    lineHeight: 20,
  },
  historySection: {
    gap: Spacing.md,
  },
  historyHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  historyCount: {
    fontSize: 13,
  },
});

