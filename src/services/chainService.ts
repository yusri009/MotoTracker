import { maintenanceRepository } from '@/db/repositories';
import type { MaintenanceRecord, MaintenanceSetting } from '@/models';
import { formatLocalDate } from '@/utils/date';

export interface ChainConfigurationInput {
  vehicleId: number;
  lastServiceOdometer: number;
  intervalKm: number;
  lastServiceDate: string;
  dueSoonThresholdKm: number;
}

export interface MarkChainLubedInput {
  vehicleId: number;
  intervalKm: number;
  dueSoonThresholdKm: number;
  notes?: string | null;
}

export interface ChainData {
  setting: MaintenanceSetting | null;
  history: MaintenanceRecord[];
}

export const chainService = {
  async load(vehicleId: number): Promise<ChainData> {
    const [setting, history] = await Promise.all([
      maintenanceRepository.getSetting(vehicleId, 'CHAIN_LUBRICATION'),
      maintenanceRepository.listRecordsForType(vehicleId, 'CHAIN_LUBRICATION'),
    ]);

    return { setting, history };
  },

  saveConfiguration(input: ChainConfigurationInput) {
    return maintenanceRepository.upsertSetting({
      vehicleId: input.vehicleId,
      kind: 'CHAIN_LUBRICATION',
      lastServiceOdometer: input.lastServiceOdometer,
      intervalKm: input.intervalKm,
      lastServiceDate: input.lastServiceDate,
      dueSoonThresholdKm: input.dueSoonThresholdKm,
      productName: null,
      lastServiceCost: null,
    });
  },

  markLubed(input: MarkChainLubedInput) {
    return maintenanceRepository.completeService({
      vehicleId: input.vehicleId,
      kind: 'CHAIN_LUBRICATION',
      type: 'CHAIN_LUBRICATION',
      intervalKm: input.intervalKm,
      servicedAt: formatLocalDate(),
      dueSoonThresholdKm: input.dueSoonThresholdKm,
      productName: null,
      cost: null,
      notes: input.notes,
    });
  },
};

