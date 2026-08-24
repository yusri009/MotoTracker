import {
  documentRepository,
  notificationRepository,
} from '@/db/repositories';
import type { SaveVehicleDocumentInput, VehicleDocument } from '@/models';
import {
  cancelDocumentReminders,
  scheduleDocumentReminders,
  type ReminderScheduleResult,
} from '@/services/notificationService';

interface InsuranceData {
  activePolicy: VehicleDocument | null;
  history: VehicleDocument[];
}

interface SaveInsuranceResult {
  activePolicy: VehicleDocument;
  history: VehicleDocument[];
  reminderResult: ReminderScheduleResult;
}

export const insuranceService = {
  async load(vehicleId: number): Promise<InsuranceData> {
    const [activePolicy, history] = await Promise.all([
      documentRepository.getActive(vehicleId, 'INSURANCE'),
      documentRepository.listByType(vehicleId, 'INSURANCE'),
    ]);

    return { activePolicy, history };
  },

  async save(
    input: Omit<SaveVehicleDocumentInput, 'type'>,
  ): Promise<SaveInsuranceResult> {
    const previousPolicy = await documentRepository.getActive(input.vehicleId, 'INSURANCE');
    const previousReminders = previousPolicy
      ? await notificationRepository.listForDocument(previousPolicy.id)
      : [];

    const activePolicy = await documentRepository.save({
      ...input,
      type: 'INSURANCE',
    });

    if (previousPolicy) {
      await cancelDocumentReminders(previousReminders);
      await notificationRepository.deleteForDocument(previousPolicy.id);
    }

    const reminderResult = await scheduleDocumentReminders(activePolicy);
    const history = await documentRepository.listByType(input.vehicleId, 'INSURANCE');

    return { activePolicy, history, reminderResult };
  },
};
