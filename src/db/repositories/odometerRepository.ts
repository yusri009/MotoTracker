import { getDatabase } from '@/db/database';
import type { CreateOdometerEntryInput, OdometerHistoryEntry } from '@/models';

const odometerSelect = `
  SELECT
    id,
    vehicle_id AS vehicleId,
    odometer,
    recorded_at AS recordedAt,
    note,
    created_at AS createdAt
  FROM odometer_history
`;

export const odometerRepository = {
  async listForVehicle(vehicleId: number): Promise<OdometerHistoryEntry[]> {
    const database = await getDatabase();
    return database.getAllAsync<OdometerHistoryEntry>(
      `${odometerSelect} WHERE vehicle_id = ? ORDER BY recorded_at DESC, id DESC`,
      vehicleId,
    );
  },

  async add(input: CreateOdometerEntryInput): Promise<OdometerHistoryEntry> {
    if (!Number.isSafeInteger(input.odometer) || input.odometer < 0) {
      throw new RangeError('Odometer must be a non-negative whole number.');
    }

    const database = await getDatabase();
    const now = new Date().toISOString();
    const recordedAt = input.recordedAt ?? now;
    let entryId = 0;

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const vehicle = await transaction.getFirstAsync<{ currentOdometer: number }>(
        'SELECT current_odometer AS currentOdometer FROM vehicles WHERE id = ?',
        input.vehicleId,
      );

      if (!vehicle) {
        throw new Error('Vehicle not found.');
      }

      if (input.odometer < vehicle.currentOdometer) {
        throw new RangeError(
          `Odometer cannot be lower than ${vehicle.currentOdometer.toLocaleString()} km.`,
        );
      }

      const result = await transaction.runAsync(
        `INSERT INTO odometer_history (
          vehicle_id,
          odometer,
          recorded_at,
          note,
          created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        input.vehicleId,
        input.odometer,
        recordedAt,
        input.note?.trim() || null,
        now,
      );

      entryId = result.lastInsertRowId;
    });

    const entry = await database.getFirstAsync<OdometerHistoryEntry>(
      `${odometerSelect} WHERE id = ?`,
      entryId,
    );

    if (!entry) {
      throw new Error('Odometer entry was saved but could not be loaded.');
    }

    return entry;
  },
};
