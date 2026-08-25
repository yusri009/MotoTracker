import { getDatabase } from '@/db/database';

const ACTIVE_VEHICLE_KEY = 'active_vehicle_id';

export const appSettingRepository = {
  async getActiveVehicleId(): Promise<number | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      ACTIVE_VEHICLE_KEY,
    );
    if (!row || !/^\d+$/.test(row.value)) return null;
    return Number(row.value);
  },

  async setActiveVehicleId(vehicleId: number): Promise<void> {
    if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0) {
      throw new RangeError('Active vehicle ID must be a positive whole number.');
    }

    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      ACTIVE_VEHICLE_KEY,
      String(vehicleId),
      new Date().toISOString(),
    );
  },

  async clearActiveVehicle(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM app_settings WHERE key = ?', ACTIVE_VEHICLE_KEY);
  },
};
