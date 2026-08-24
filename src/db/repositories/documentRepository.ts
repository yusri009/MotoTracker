import { getDatabase } from '@/db/database';
import type { DocumentType, SaveVehicleDocumentInput, VehicleDocument } from '@/models';

type DocumentRow = Omit<VehicleDocument, 'isActive'> & { isActive: number };

const documentSelect = `
  SELECT
    id,
    vehicle_id AS vehicleId,
    type,
    provider,
    policy_number AS policyNumber,
    start_date AS startDate,
    expiry_date AS expiryDate,
    cost,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM documents
`;

function mapDocument(row: DocumentRow): VehicleDocument {
  return { ...row, isActive: row.isActive === 1 };
}

export const documentRepository = {
  async getActive(
    vehicleId: number,
    type: DocumentType,
  ): Promise<VehicleDocument | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<DocumentRow>(
      `${documentSelect} WHERE vehicle_id = ? AND type = ? AND is_active = 1`,
      vehicleId,
      type,
    );

    return row ? mapDocument(row) : null;
  },

  async listActive(vehicleId: number): Promise<VehicleDocument[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<DocumentRow>(
      `${documentSelect} WHERE vehicle_id = ? AND is_active = 1 ORDER BY expiry_date ASC`,
      vehicleId,
    );

    return rows.map(mapDocument);
  },

  async listByType(vehicleId: number, type: DocumentType): Promise<VehicleDocument[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<DocumentRow>(
      `${documentSelect}
       WHERE vehicle_id = ? AND type = ?
       ORDER BY is_active DESC, start_date DESC, created_at DESC`,
      vehicleId,
      type,
    );

    return rows.map(mapDocument);
  },

  async save(input: SaveVehicleDocumentInput): Promise<VehicleDocument> {
    if (input.expiryDate < input.startDate) {
      throw new RangeError('Expiry date cannot be before the start or issue date.');
    }

    if (input.cost != null && input.cost < 0) {
      throw new RangeError('Document cost cannot be negative.');
    }

    const database = await getDatabase();
    const now = new Date().toISOString();
    let documentId = 0;

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `UPDATE documents
         SET is_active = 0, updated_at = ?
         WHERE vehicle_id = ? AND type = ? AND is_active = 1`,
        now,
        input.vehicleId,
        input.type,
      );

      const result = await transaction.runAsync(
        `INSERT INTO documents (
          vehicle_id,
          type,
          provider,
          policy_number,
          start_date,
          expiry_date,
          cost,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        input.vehicleId,
        input.type,
        input.provider?.trim() || null,
        input.policyNumber?.trim() || null,
        input.startDate,
        input.expiryDate,
        input.cost ?? null,
        now,
        now,
      );

      documentId = result.lastInsertRowId;
    });

    const row = await database.getFirstAsync<DocumentRow>(
      `${documentSelect} WHERE id = ?`,
      documentId,
    );

    if (!row) {
      throw new Error('Document was saved but could not be loaded.');
    }

    return mapDocument(row);
  },
};
