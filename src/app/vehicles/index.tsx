import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { appSettingRepository, vehicleRepository } from '@/db/repositories';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';
import type { Vehicle } from '@/models';
import { formatKilometres } from '@/utils/maintenance';

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Vehicles could not be loaded.';
}

export default function VehiclesScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const database = useDatabaseStatus();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (database.state !== 'ready') return;

      let active = true;
      setLoading(true);
      setError(null);

      void Promise.all([vehicleRepository.list(), vehicleRepository.getPrimary()]).then(
        ([savedVehicles, activeVehicle]) => {
          if (!active) return;
          setVehicles(savedVehicles);
          setActiveVehicleId(activeVehicle?.id ?? null);
          setLoading(false);
        },
        (reason: unknown) => {
          if (active) {
            setError(getErrorMessage(reason));
            setLoading(false);
          }
        },
      );

      return () => {
        active = false;
      };
    }, [database.state]),
  );

  async function switchVehicle(vehicle: Vehicle) {
    if (vehicle.id === activeVehicleId || switchingId != null) return;

    setSwitchingId(vehicle.id);
    setError(null);
    try {
      await appSettingRepository.setActiveVehicleId(vehicle.id);
      setActiveVehicleId(vehicle.id);
      router.replace('/' as Href);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason));
      setSwitchingId(null);
    }
  }

  if (loading || database.state === 'initializing') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading vehicles…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.text }]}>My vehicles</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Switch the active dashboard or add another vehicle. Each vehicle keeps separate mileage, maintenance, documents, and reminder settings.</Text>
        </View>

        <PrimaryButton
          title="Add another vehicle"
          onPress={() =>
            router.push({ pathname: '/vehicle/edit', params: { mode: 'new' } } as Href)
          }
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <View style={styles.list}>
          {vehicles.map((vehicle) => {
            const isActive = vehicle.id === activeVehicleId;
            const isSwitching = switchingId === vehicle.id;

            return (
              <View
                key={vehicle.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={styles.vehicleRow}>
                  {vehicle.imageUri ? (
                    <Image source={{ uri: vehicle.imageUri }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <View style={[styles.image, styles.placeholder, { backgroundColor: colors.accentSoft }]}>
                      <Text style={styles.placeholderIcon}>🏍️</Text>
                    </View>
                  )}
                  <View style={styles.vehicleCopy}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{vehicle.name}</Text>
                      {isActive ? (
                        <View style={[styles.activeBadge, { backgroundColor: colors.successSoft }]}>
                          <Text style={[styles.activeText, { color: colors.success }]}>ACTIVE</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.model, { color: colors.textMuted }]}>{vehicle.brand} {vehicle.model}</Text>
                    <Text style={[styles.registration, { color: colors.primary }]}>{vehicle.registrationNumber}</Text>
                    <Text style={[styles.odometer, { color: colors.textMuted }]}>{formatKilometres(vehicle.currentOdometer)} km</Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  {!isActive ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={switchingId != null}
                      onPress={() => void switchVehicle(vehicle)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        { backgroundColor: colors.accentSoft, opacity: pressed ? 0.75 : 1 },
                      ]}
                    >
                      <Text style={[styles.actionText, { color: colors.primary }]}>{isSwitching ? 'Switching…' : 'Use this vehicle'}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/vehicle/edit',
                        params: { vehicleId: String(vehicle.id) },
                      } as Href)
                    }
                    style={({ pressed }) => [
                      styles.actionButton,
                      { borderColor: colors.border, borderWidth: 1, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={[styles.actionText, { color: colors.text }]}>Edit</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { fontSize: 15 },
  content: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.xl },
  intro: { gap: Spacing.sm },
  title: { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  error: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  list: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.lg, borderWidth: 1, borderRadius: Radius.md },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  image: { width: 72, height: 72, borderRadius: Radius.md },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 28 },
  vehicleCopy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flex: 1, fontSize: 19, fontWeight: '800' },
  model: { fontSize: 14 },
  registration: { marginTop: Spacing.xs, fontSize: 12, fontWeight: '800' },
  odometer: { fontSize: 13, fontWeight: '600' },
  activeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  activeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  actionButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: Spacing.md, borderRadius: Radius.sm },
  actionText: { fontSize: 13, fontWeight: '700' },
});
