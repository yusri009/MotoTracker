import { getDatabase } from '@/db/database';
import type { NotificationReminder } from '@/models';

interface SaveNotificationReminderInput {
  daysBefore: number;
  notificationIdentifier: string;
  scheduledFor: string;
}

const reminderSelect = `
  SELECT
    id,
    document_id AS documentId,
    days_before AS daysBefore,
    notification_identifier AS notificationIdentifier,
    scheduled_for AS scheduledFor,
    created_at AS createdAt
  FROM notification_reminders
`;

export const notificationRepository = {
  async listForDocument(documentId: number): Promise<NotificationReminder[]> {
    const database = await getDatabase();
    return database.getAllAsync<NotificationReminder>(
      `${reminderSelect} WHERE document_id = ? ORDER BY days_before DESC`,
      documentId,
    );
  },

  async replaceForDocument(
    documentId: number,
    reminders: SaveNotificationReminderInput[],
  ): Promise<void> {
    const database = await getDatabase();
    const now = new Date().toISOString();

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        'DELETE FROM notification_reminders WHERE document_id = ?',
        documentId,
      );

      for (const reminder of reminders) {
        await transaction.runAsync(
          `INSERT INTO notification_reminders (
            document_id,
            days_before,
            notification_identifier,
            scheduled_for,
            created_at
          ) VALUES (?, ?, ?, ?, ?)`,
          documentId,
          reminder.daysBefore,
          reminder.notificationIdentifier,
          reminder.scheduledFor,
          now,
        );
      }
    });
  },

  async deleteForDocument(documentId: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'DELETE FROM notification_reminders WHERE document_id = ?',
      documentId,
    );
  },
};
