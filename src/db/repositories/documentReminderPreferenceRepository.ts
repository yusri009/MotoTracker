import { getDatabase } from '@/db/database';
import type { DocumentReminderPreference, DocumentType } from '@/models';

export const DEFAULT_DOCUMENT_REMINDER_DAYS = [30, 14, 7, 1] as const;

function validateDays(days: number[]) {
  const uniqueDays = [...new Set(days)].sort((left, right) => right - left);

  if (
    uniqueDays.length === 0 ||
    uniqueDays.length > 10 ||
    uniqueDays.some((day) => !Number.isSafeInteger(day) || day < 0 || day > 365)
  ) {
    throw new RangeError('Reminder days must contain 1–10 unique whole numbers from 0 to 365.');
  }

  return uniqueDays;
}

export const documentReminderPreferenceRepository = {
  async getDays(vehicleId: number, documentType: DocumentType): Promise<number[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<Pick<DocumentReminderPreference, 'daysBefore'>>(
      `SELECT days_before AS daysBefore
       FROM document_reminder_preferences
       WHERE vehicle_id = ? AND document_type = ?
       ORDER BY days_before DESC`,
      vehicleId,
      documentType,
    );

    return rows.length > 0
      ? rows.map((row) => row.daysBefore)
      : [...DEFAULT_DOCUMENT_REMINDER_DAYS];
  },

  async replaceDays(
    vehicleId: number,
    documentType: DocumentType,
    days: number[],
  ): Promise<number[]> {
    const validatedDays = validateDays(days);
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `DELETE FROM document_reminder_preferences
         WHERE vehicle_id = ? AND document_type = ?`,
        vehicleId,
        documentType,
      );

      for (const daysBefore of validatedDays) {
        await transaction.runAsync(
          `INSERT INTO document_reminder_preferences (
            vehicle_id,
            document_type,
            days_before,
            created_at
          ) VALUES (?, ?, ?, ?)`,
          vehicleId,
          documentType,
          daysBefore,
          now,
        );
      }
    });

    return validatedDays;
  },
};
