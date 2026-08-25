import {
  documentReminderPreferenceRepository,
  documentRepository,
  notificationRepository,
} from '@/db/repositories';
import type { DocumentType } from '@/models';
import {
  cancelDocumentReminders,
  scheduleDocumentReminders,
  type ReminderScheduleResult,
} from '@/services/notificationService';

export interface ReminderPreferenceSaveResult {
  days: number[];
  reminderResult: ReminderScheduleResult | null;
}

export const documentReminderService = {
  async load(vehicleId: number) {
    const [insuranceDays, licenceDays] = await Promise.all([
      documentReminderPreferenceRepository.getDays(vehicleId, 'INSURANCE'),
      documentReminderPreferenceRepository.getDays(vehicleId, 'REVENUE_LICENCE'),
    ]);
    return { insuranceDays, licenceDays };
  },

  async save(
    vehicleId: number,
    documentType: DocumentType,
    days: number[],
  ): Promise<ReminderPreferenceSaveResult> {
    const savedDays = await documentReminderPreferenceRepository.replaceDays(
      vehicleId,
      documentType,
      days,
    );
    const activeDocument = await documentRepository.getActive(vehicleId, documentType);

    if (!activeDocument) {
      return { days: savedDays, reminderResult: null };
    }

    const previousReminders = await notificationRepository.listForDocument(activeDocument.id);
    await cancelDocumentReminders(previousReminders);
    await notificationRepository.deleteForDocument(activeDocument.id);
    const reminderResult = await scheduleDocumentReminders(activeDocument, savedDays);

    return { days: savedDays, reminderResult };
  },
};
