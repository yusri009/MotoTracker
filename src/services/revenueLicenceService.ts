import {
  documentRepository,
  documentReminderPreferenceRepository,
  notificationRepository,
} from '@/db/repositories';
import type { SaveVehicleDocumentInput, VehicleDocument } from '@/models';
import {
  cancelDocumentReminders,
  scheduleDocumentReminders,
  type ReminderScheduleResult,
} from '@/services/notificationService';

interface RevenueLicenceData {
  activeLicence: VehicleDocument | null;
  history: VehicleDocument[];
}

interface SaveRevenueLicenceResult {
  activeLicence: VehicleDocument;
  history: VehicleDocument[];
  reminderResult: ReminderScheduleResult;
}

export const revenueLicenceService = {
  async load(vehicleId: number): Promise<RevenueLicenceData> {
    const [activeLicence, history] = await Promise.all([
      documentRepository.getActive(vehicleId, 'REVENUE_LICENCE'),
      documentRepository.listByType(vehicleId, 'REVENUE_LICENCE'),
    ]);

    return { activeLicence, history };
  },

  async save(
    input: Omit<SaveVehicleDocumentInput, 'type' | 'provider' | 'policyNumber'>,
  ): Promise<SaveRevenueLicenceResult> {
    const previousLicence = await documentRepository.getActive(
      input.vehicleId,
      'REVENUE_LICENCE',
    );
    const previousReminders = previousLicence
      ? await notificationRepository.listForDocument(previousLicence.id)
      : [];

    const activeLicence = await documentRepository.save({
      ...input,
      type: 'REVENUE_LICENCE',
      provider: null,
      policyNumber: null,
    });

    if (previousLicence) {
      await cancelDocumentReminders(previousReminders);
      await notificationRepository.deleteForDocument(previousLicence.id);
    }

    const reminderDays = await documentReminderPreferenceRepository.getDays(
      input.vehicleId,
      'REVENUE_LICENCE',
    );
    const reminderResult = await scheduleDocumentReminders(activeLicence, reminderDays);
    const history = await documentRepository.listByType(
      input.vehicleId,
      'REVENUE_LICENCE',
    );

    return { activeLicence, history, reminderResult };
  },
};
