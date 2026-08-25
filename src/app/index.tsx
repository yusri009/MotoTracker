import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dashboard } from '@/components/dashboard/Dashboard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { documentRepository, maintenanceRepository, vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { MaintenanceSetting, Vehicle, VehicleDocument } from '@/models';

type DashboardLoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [maintenanceSettings, setMaintenanceSettings] = useState<MaintenanceSetting[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loadState, setLoadState] = useState<DashboardLoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (database.state !== 'ready') {
        return;
      }

      let active = true;
      setLoadState('loading');
      setLoadError(null);

      void (async () => {
        const savedVehicle = await vehicleRepository.getPrimary();

        if (!savedVehicle) {
          if (active) {
            setVehicle(null);
            setMaintenanceSettings([]);
            setDocuments([]);
            setLoadState('ready');
          }
          return;
        }

        const [savedSettings, savedDocuments] = await Promise.all([
          maintenanceRepository.getSettings(savedVehicle.id),
          documentRepository.listActive(savedVehicle.id),
        ]);

        if (active) {
          setVehicle(savedVehicle);
          setMaintenanceSettings(savedSettings);
          setDocuments(savedDocuments);
          setLoadState('ready');
        }
      })().catch((reason: unknown) => {
        if (active) {
          setLoadError(reason instanceof Error ? reason.message : 'Unable to load dashboard.');
          setLoadState('error');
        }
      });

      return () => {
        active = false;
      };
    }, [database.state, reloadKey]),
  );

  const databaseCopy = {
    initializing: {
      title: 'Preparing local storage',
      detail: 'Creating the offline database on this device…',
      color: colors.warning,
    },
    ready: {
      title: loadState === 'loading' ? 'Loading dashboard' : 'Local database ready',
      detail: loadState === 'loading' ? 'Calculating maintenance status…' : 'Your data stays on this device.',
      color: colors.success,
    },
    error: {
      title: 'Database setup failed',
      detail: database.error ? `${database.error} Tap to retry.` : 'Tap to retry.',
      color: colors.danger,
    },
  }[database.state];

  const isLoading =
    database.state !== 'ready' || loadState === 'loading' || loadState === 'idle';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={[styles.mark, { backgroundColor: colors.accentSoft }]}>
            <Image
              accessibilityLabel="MotoTracker"
              source={require('../../assets/mototracker-icon.png')}
              style={styles.markIcon}
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>MOTOTRACKER</Text>
          <ThemeToggleButton />
        </View>

        {isLoading ? (
          <View style={styles.hero}>
            <Text style={[styles.title, { color: colors.text }]}>Your vehicle, looked after.</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Preparing your maintenance dashboard.</Text>
          </View>
        ) : loadState === 'error' ? (
          <View style={styles.centeredState}>
            <View style={styles.hero}>
              <Text style={[styles.title, { color: colors.text }]}>Dashboard unavailable</Text>
              <Text style={[styles.subtitle, { color: colors.danger }]}>{loadError}</Text>
            </View>
            <PrimaryButton title="Try again" onPress={() => setReloadKey((value) => value + 1)} />
          </View>
        ) : vehicle ? (
          <Dashboard
            vehicle={vehicle}
            maintenanceSettings={maintenanceSettings}
            documents={documents}
            onEditProfile={() =>
              router.push({
                pathname: '/vehicle/edit',
                params: { vehicleId: String(vehicle.id) },
              })
            }
            onUpdateOdometer={() => router.push('./odometer/update')}
            onManageOil={() => router.push('./maintenance/oil')}
            onManageChain={() => router.push('./maintenance/chain')}
            onManageInsurance={() => router.push('./insurance')}
            onManageLicence={() => router.push('./licence')}
            onViewHistory={() => router.push('./maintenance/history')}
            onOpenSettings={() => router.push('./settings')}
            onManageVehicles={() => router.push('./vehicles')}
          />
        ) : (
          <View style={styles.centeredState}>
            <View style={styles.hero}>
              <Text style={[styles.title, { color: colors.text }]}>Add your first vehicle</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Create a profile to start tracking mileage, maintenance, insurance, and licence dates.</Text>
            </View>
            <PrimaryButton title="Set up vehicle" onPress={() => router.push('./vehicle/edit')} />
          </View>
        )}

        {isLoading ? (
          <Pressable
            accessibilityRole={database.state === 'error' ? 'button' : undefined}
            disabled={database.state !== 'error'}
            onPress={database.retry}
            style={[
              styles.statusCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: databaseCopy.color }]} />
            <View style={styles.statusCopy}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>{databaseCopy.title}</Text>
              <Text style={[styles.statusText, { color: colors.textMuted }]}>{databaseCopy.detail}</Text>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.xl,
    paddingBottom: 48,
    gap: Spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mark: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  markIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
  },
  eyebrow: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  hero: {
    gap: Spacing.sm,
  },
  title: {
    maxWidth: 340,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
  },
  subtitle: {
    maxWidth: 370,
    fontSize: 16,
    lineHeight: 24,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusCopy: {
    flex: 1,
    gap: 3,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
