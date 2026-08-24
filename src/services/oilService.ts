import { maintenanceRepository } from '@/db/repositories';
import type { MaintenanceRecord, MaintenanceSetting } from '@/models';
import { formatLocalDate } from '@/utils/date';

export interface OilConfigurationInput {
  vehicleId: number;
  lastServiceOdometer: number;
  intervalKm: number;
  lastServiceDate: string;
  dueSoonThresholdKm: number;
  productName?: string | null;
  cost?: number | null;
}

export interface MarkOilChangedInput {
  vehicleId: number;
  intervalKm: number;
  dueSoonThresholdKm: number;
  productName?: string | null;
  cost?: number | null;
  notes?: string | null;
}

export interface OilData {
  setting: MaintenanceSetting | null;
  history: MaintenanceRecord[];
}

export const oilService = {
  async load(vehicleId: number): Promise<OilData> {
    const [setting, history] = await Promise.all([
      maintenanceRepository.getSetting(vehicleId, 'ENGINE_OIL'),
      maintenanceRepository.listRecordsForType(vehicleId, 'OIL_CHANGE'),
    ]);

    return { setting, history };
  },

  saveConfiguration(input: OilConfigurationInput) {
    return maintenanceRepository.upsertSetting({
      vehicleId: input.vehicleId,
      kind: 'ENGINE_OIL',
      lastServiceOdometer: input.lastServiceOdometer,
      intervalKm: input.intervalKm,
      lastServiceDate: input.lastServiceDate,
      dueSoonThresholdKm: input.dueSoonThresholdKm,
      productName: input.productName,
      lastServiceCost: input.cost,
    });
  },

  markChanged(input: MarkOilChangedInput) {
    return maintenanceRepository.completeService({
      vehicleId: input.vehicleId,
      kind: 'ENGINE_OIL',
      type: 'OIL_CHANGE',
      intervalKm: input.intervalKm,
      servicedAt: formatLocalDate(),
      dueSoonThresholdKm: input.dueSoonThresholdKm,
      productName: input.productName,
      cost: input.cost,
      notes: input.notes,
    });
  },
};

