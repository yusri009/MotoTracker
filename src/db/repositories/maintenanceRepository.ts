import { getDatabase } from '@/db/database';
import type {
  CompleteMaintenanceInput,
  CompleteMaintenanceResult,
  CreateMaintenanceRecordInput,
  MaintenanceRecord,
  MaintenanceSetting,
  MaintenanceType,
  UpsertMaintenanceSettingInput,
} from '@/models';

const recordSelect = `
  SELECT
    id,
    vehicle_id AS vehicleId,
    type,
    serviced_at AS servicedAt,
    odometer,
    cost,
    notes,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM maintenance_records
`;

const settingSelect = `
  SELECT
    id,
    vehicle_id AS vehicleId,
    kind,
    last_service_odometer AS lastServiceOdometer,
    interval_km AS intervalKm,
    last_service_date AS lastServiceDate,
    due_soon_threshold_km AS dueSoonThresholdKm,
    product_name AS productName,
    last_service_cost AS lastServiceCost,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM maintenance_settings
`;

function validateCost(cost: number | null | undefined) {
  if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
    throw new RangeError('Maintenance cost cannot be negative.');
  }
}

function validateInterval(intervalKm: number, threshold: number) {
  if (!Number.isSafeInteger(intervalKm) || intervalKm <= 0) {
    throw new RangeError('Maintenance interval must be a positive whole number.');
  }

  if (!Number.isSafeInteger(threshold) || threshold < 0) {
    throw new RangeError('Due-soon threshold must be a non-negative whole number.');
  }
}

export const maintenanceRepository = {
  async listRecords(vehicleId: number): Promise<MaintenanceRecord[]> {
    const database = await getDatabase();
    return database.getAllAsync<MaintenanceRecord>(
      `${recordSelect} WHERE vehicle_id = ? ORDER BY serviced_at DESC, id DESC`,
      vehicleId,
    );
  },

  async listRecordsForType(
    vehicleId: number,
    type: MaintenanceType,
  ): Promise<MaintenanceRecord[]> {
    const database = await getDatabase();
    return database.getAllAsync<MaintenanceRecord>(
      `${recordSelect} WHERE vehicle_id = ? AND type = ? ORDER BY serviced_at DESC, id DESC`,
      vehicleId,
      type,
    );
  },

  async addRecord(input: CreateMaintenanceRecordInput): Promise<MaintenanceRecord> {
    if (!Number.isSafeInteger(input.odometer) || input.odometer < 0) {
      throw new RangeError('Maintenance odometer must be a non-negative whole number.');
    }

    validateCost(input.cost);

    const database = await getDatabase();
    const now = new Date().toISOString();
    const result = await database.runAsync(
      `INSERT INTO maintenance_records (
        vehicle_id,
        type,
        serviced_at,
        odometer,
        cost,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.vehicleId,
      input.type,
      input.servicedAt,
      input.odometer,
      input.cost ?? null,
      input.notes?.trim() || null,
      now,
      now,
    );

    const record = await database.getFirstAsync<MaintenanceRecord>(
      `${recordSelect} WHERE id = ?`,
      result.lastInsertRowId,
    );

    if (!record) {
      throw new Error('Maintenance record was saved but could not be loaded.');
    }

    return record;
  },

  async getSettings(vehicleId: number): Promise<MaintenanceSetting[]> {
    const database = await getDatabase();
    return database.getAllAsync<MaintenanceSetting>(
      `${settingSelect} WHERE vehicle_id = ? ORDER BY kind ASC`,
      vehicleId,
    );
  },

  async getSetting(
    vehicleId: number,
    kind: MaintenanceSetting['kind'],
  ): Promise<MaintenanceSetting | null> {
    const database = await getDatabase();
    return database.getFirstAsync<MaintenanceSetting>(
      `${settingSelect} WHERE vehicle_id = ? AND kind = ?`,
      vehicleId,
      kind,
    );
  },

  async upsertSetting(input: UpsertMaintenanceSettingInput): Promise<MaintenanceSetting> {
    if (!Number.isSafeInteger(input.lastServiceOdometer) || input.lastServiceOdometer < 0) {
      throw new RangeError('Last service odometer must be a non-negative whole number.');
    }

    const threshold = input.dueSoonThresholdKm ?? 300;
    validateInterval(input.intervalKm, threshold);
    validateCost(input.lastServiceCost);

    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.runAsync(
      `INSERT INTO maintenance_settings (
        vehicle_id,
        kind,
        last_service_odometer,
        interval_km,
        last_service_date,
        due_soon_threshold_km,
        product_name,
        last_service_cost,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(vehicle_id, kind) DO UPDATE SET
        last_service_odometer = excluded.last_service_odometer,
        interval_km = excluded.interval_km,
        last_service_date = excluded.last_service_date,
        due_soon_threshold_km = excluded.due_soon_threshold_km,
        product_name = excluded.product_name,
        last_service_cost = excluded.last_service_cost,
        updated_at = excluded.updated_at`,
      input.vehicleId,
      input.kind,
      input.lastServiceOdometer,
      input.intervalKm,
      input.lastServiceDate,
      threshold,
      input.productName?.trim() || null,
      input.lastServiceCost ?? null,
      now,
      now,
    );

    const setting = await database.getFirstAsync<MaintenanceSetting>(
      `${settingSelect} WHERE vehicle_id = ? AND kind = ?`,
      input.vehicleId,
      input.kind,
    );

    if (!setting) {
      throw new Error('Maintenance settings were saved but could not be loaded.');
    }

    return setting;
  },

  async completeService(input: CompleteMaintenanceInput): Promise<CompleteMaintenanceResult> {
    const threshold = input.dueSoonThresholdKm ?? 300;
    validateInterval(input.intervalKm, threshold);
    validateCost(input.cost);

    if (!input.servicedAt.trim()) {
      throw new Error('Service date is required.');
    }

    const database = await getDatabase();
    const now = new Date().toISOString();
    let recordId = 0;

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const vehicle = await transaction.getFirstAsync<{ currentOdometer: number }>(
        'SELECT current_odometer AS currentOdometer FROM vehicles WHERE id = ?',
        input.vehicleId,
      );

      if (!vehicle) {
        throw new Error('Vehicle not found.');
      }

      const result = await transaction.runAsync(
        `INSERT INTO maintenance_records (
          vehicle_id,
          type,
          serviced_at,
          odometer,
          cost,
          notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        input.vehicleId,
        input.type,
        input.servicedAt,
        vehicle.currentOdometer,
        input.cost ?? null,
        input.notes?.trim() || null,
        now,
        now,
      );
      recordId = result.lastInsertRowId;

      await transaction.runAsync(
        `INSERT INTO maintenance_settings (
          vehicle_id,
          kind,
          last_service_odometer,
          interval_km,
          last_service_date,
          due_soon_threshold_km,
          product_name,
          last_service_cost,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(vehicle_id, kind) DO UPDATE SET
          last_service_odometer = excluded.last_service_odometer,
          interval_km = excluded.interval_km,
          last_service_date = excluded.last_service_date,
          due_soon_threshold_km = excluded.due_soon_threshold_km,
          product_name = excluded.product_name,
          last_service_cost = excluded.last_service_cost,
          updated_at = excluded.updated_at`,
        input.vehicleId,
        input.kind,
        vehicle.currentOdometer,
        input.intervalKm,
        input.servicedAt,
        threshold,
        input.productName?.trim() || null,
        input.cost ?? null,
        now,
        now,
      );
    });

    const [record, setting] = await Promise.all([
      database.getFirstAsync<MaintenanceRecord>(`${recordSelect} WHERE id = ?`, recordId),
      database.getFirstAsync<MaintenanceSetting>(
        `${settingSelect} WHERE vehicle_id = ? AND kind = ?`,
        input.vehicleId,
        input.kind,
      ),
    ]);

    if (!record || !setting) {
      throw new Error('Maintenance was saved but could not be loaded.');
    }

    return { record, setting };
  },
};
