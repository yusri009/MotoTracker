import { Image, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { ExpiryCard } from '@/components/dashboard/ExpiryCard';
import { MaintenanceCard } from '@/components/dashboard/MaintenanceCard';
import { OdometerCard } from '@/components/dashboard/OdometerCard';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { MaintenanceSetting, Vehicle, VehicleDocument } from '@/models';
import { calculateDateExpiry, calculateKmMaintenance } from '@/utils/maintenance';

interface DashboardProps {
  vehicle: Vehicle;
  maintenanceSettings: MaintenanceSetting[];
  documents: VehicleDocument[];
  onEditProfile: () => void;
  onUpdateOdometer: () => void;
  onManageOil: () => void;
  onManageChain: () => void;
  onManageInsurance: () => void;
  onManageLicence: () => void;
  onViewHistory: () => void;
  onOpenSettings: () => void;
  onManageVehicles: () => void;
}

export function Dashboard({
  vehicle,
  maintenanceSettings,
  documents,
  onEditProfile,
  onUpdateOdometer,
  onManageOil,
  onManageChain,
  onManageInsurance,
  onManageLicence,
  onViewHistory,
  onOpenSettings,
  onManageVehicles,
}: DashboardProps) {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const oilSetting = maintenanceSettings.find((setting) => setting.kind === 'ENGINE_OIL');
  const chainSetting = maintenanceSettings.find(
    (setting) => setting.kind === 'CHAIN_LUBRICATION',
  );
  const insurance = documents.find((document) => document.type === 'INSURANCE');
  const licence = documents.find((document) => document.type === 'REVENUE_LICENCE');

  const oilCalculation = oilSetting
    ? calculateKmMaintenance(
        vehicle.currentOdometer,
        oilSetting.lastServiceOdometer,
        oilSetting.intervalKm,
        oilSetting.dueSoonThresholdKm,
      )
    : null;
  const chainCalculation = chainSetting
    ? calculateKmMaintenance(
        vehicle.currentOdometer,
        chainSetting.lastServiceOdometer,
        chainSetting.intervalKm,
        chainSetting.dueSoonThresholdKm,
      )
    : null;
  const insuranceCalculation = insurance ? calculateDateExpiry(insurance.expiryDate) : null;
  const licenceCalculation = licence ? calculateDateExpiry(licence.expiryDate) : null;

  return (
    <View style={styles.dashboard}>
      <View style={styles.profileRow}>
        {vehicle.imageUri ? (
          <Image source={{ uri: vehicle.imageUri }} style={styles.profileImage} resizeMode="cover" />
        ) : (
          <View style={[styles.profileImage, styles.placeholder, { backgroundColor: colors.accentSoft }]}>
            <Text style={styles.placeholderIcon}>🏍️</Text>
          </View>
        )}

        <View style={styles.profileCopy}>
          <Text style={[styles.vehicleName, { color: colors.text }]} numberOfLines={1}>
            {vehicle.name}
          </Text>
          <Text style={[styles.vehicleModel, { color: colors.textMuted }]} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
          <Text style={[styles.registration, { color: colors.primary }]}>
            {vehicle.registrationNumber}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit vehicle profile"
          onPress={onEditProfile}
          style={({ pressed }) => [
            styles.editButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
        </Pressable>
      </View>

      <OdometerCard currentOdometer={vehicle.currentOdometer} onPress={onUpdateOdometer} />

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Maintenance</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Distance based</Text>
        </View>
        <View style={styles.cardList}>
          <MaintenanceCard
            title="Engine oil"
            icon="🛢️"
            calculation={oilCalculation}
            onPress={onManageOil}
          />
          <MaintenanceCard
            title="Chain lubrication"
            icon="⛓️"
            calculation={chainCalculation}
            onPress={onManageChain}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Documents</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Expiry dates</Text>
        </View>
        <View style={styles.cardList}>
          <ExpiryCard
            title="Insurance"
            icon="🛡️"
            expiryDate={insurance?.expiryDate ?? null}
            calculation={insuranceCalculation}
            onPress={onManageInsurance}
          />
          <ExpiryCard
            title="Revenue licence"
            icon="📄"
            expiryDate={licence?.expiryDate ?? null}
            calculation={licenceCalculation}
            onPress={onManageLicence}
          />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onManageVehicles}
        style={({ pressed }) => [
          styles.historyButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={styles.historyCopy}>
          <Text style={styles.historyIcon}>🏍️</Text>
          <View style={styles.historyText}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>My vehicles</Text>
            <Text style={[styles.historySubtitle, { color: colors.textMuted }]}>Add, edit, or switch the active vehicle</Text>
          </View>
        </View>
        <Text style={[styles.historyArrow, { color: colors.primary }]}>→</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onViewHistory}
        style={({ pressed }) => [
          styles.historyButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={styles.historyCopy}>
          <Text style={styles.historyIcon}>📋</Text>
          <View style={styles.historyText}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>Maintenance history</Text>
            <Text style={[styles.historySubtitle, { color: colors.textMuted }]}>View all work or add a manual event</Text>
          </View>
        </View>
        <Text style={[styles.historyArrow, { color: colors.primary }]}>→</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenSettings}
        style={({ pressed }) => [
          styles.historyButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={styles.historyCopy}>
          <Text style={styles.historyIcon}>⚙️</Text>
          <View style={styles.historyText}>
            <Text style={[styles.historyTitle, { color: colors.text }]}>Settings & data</Text>
            <Text style={[styles.historySubtitle, { color: colors.textMuted }]}>Reminder timing and local backup</Text>
          </View>
        </View>
        <Text style={[styles.historyArrow, { color: colors.primary }]}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    gap: Spacing.xl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileImage: {
    width: 68,
    height: 68,
    borderRadius: Radius.md,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 30,
  },
  profileCopy: {
    flex: 1,
    gap: 2,
  },
  vehicleName: {
    fontSize: 23,
    fontWeight: '800',
  },
  vehicleModel: {
    fontSize: 14,
  },
  registration: {
    marginTop: Spacing.xs,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  editButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardList: {
    gap: Spacing.md,
  },
  historyButton: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  historyCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  historyIcon: { fontSize: 22 },
  historyText: { flex: 1, gap: Spacing.xs },
  historyTitle: { fontSize: 16, fontWeight: '800' },
  historySubtitle: { fontSize: 13, lineHeight: 18 },
  historyArrow: { fontSize: 22, fontWeight: '700' },
});
