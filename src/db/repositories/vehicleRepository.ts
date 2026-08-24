import { getDatabase } from '@/db/database';
import type { CreateVehicleInput, UpdateVehicleProfileInput, Vehicle } from '@/models';

function validateProfileInput(input: UpdateVehicleProfileInput) {
  if (!input.name.trim() || !input.brand.trim() || !input.model.trim()) {
    throw new Error('Vehicle name, brand, and model are required.');
  }

  if (!input.registrationNumber.trim()) {
    throw new Error('Registration number is required.');
  }

}

function validateVehicleInput(input: CreateVehicleInput) {
  validateProfileInput(input);

  if (!Number.isSafeInteger(input.currentOdometer) || input.currentOdometer < 0) {
    throw new RangeError('Current odometer must be a non-negative whole number.');
  }
}

const vehicleSelect = `
  SELECT
    id,
    name,
    brand,
    model,
    registration_number AS registrationNumber,
    current_odometer AS currentOdometer,
    image_uri AS imageUri,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM vehicles
`;

export const vehicleRepository = {
  async list(): Promise<Vehicle[]> {
    const database = await getDatabase();
    return database.getAllAsync<Vehicle>(`${vehicleSelect} ORDER BY created_at ASC`);
  },

  async getById(id: number): Promise<Vehicle | null> {
    const database = await getDatabase();
    return database.getFirstAsync<Vehicle>(`${vehicleSelect} WHERE id = ?`, id);
  },

  async getPrimary(): Promise<Vehicle | null> {
    const database = await getDatabase();
    return database.getFirstAsync<Vehicle>(`${vehicleSelect} ORDER BY created_at ASC LIMIT 1`);
  },

  async create(input: CreateVehicleInput): Promise<Vehicle> {
    validateVehicleInput(input);

    const database = await getDatabase();
    const now = new Date().toISOString();
    let vehicleId = 0;

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const result = await transaction.runAsync(
        `INSERT INTO vehicles (
          name,
          brand,
          model,
          registration_number,
          current_odometer,
          image_uri,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        input.name.trim(),
        input.brand.trim(),
        input.model.trim(),
        input.registrationNumber.trim().toUpperCase(),
        input.currentOdometer,
        input.imageUri ?? null,
        now,
        now,
      );

      vehicleId = result.lastInsertRowId;

      await transaction.runAsync(
        `INSERT INTO odometer_history (
          vehicle_id,
          odometer,
          recorded_at,
          note,
          created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        vehicleId,
        input.currentOdometer,
        now,
        'Initial odometer reading',
        now,
      );
    });

    const vehicle = await database.getFirstAsync<Vehicle>(
      `${vehicleSelect} WHERE id = ?`,
      vehicleId,
    );

    if (!vehicle) {
      throw new Error('Vehicle was created but could not be loaded.');
    }

    return vehicle;
  },

  async updateProfile(id: number, input: UpdateVehicleProfileInput): Promise<Vehicle> {
    validateProfileInput(input);

    const database = await getDatabase();
    const result = await database.runAsync(
      `UPDATE vehicles
       SET name = ?,
           brand = ?,
           model = ?,
           registration_number = ?,
           image_uri = ?,
           updated_at = ?
       WHERE id = ?`,
      input.name.trim(),
      input.brand.trim(),
      input.model.trim(),
      input.registrationNumber.trim().toUpperCase(),
      input.imageUri ?? null,
      new Date().toISOString(),
      id,
    );

    if (result.changes === 0) {
      throw new Error('Vehicle not found.');
    }

    const vehicle = await database.getFirstAsync<Vehicle>(`${vehicleSelect} WHERE id = ?`, id);

    if (!vehicle) {
      throw new Error('Vehicle was updated but could not be loaded.');
    }

    return vehicle;
  },
};
