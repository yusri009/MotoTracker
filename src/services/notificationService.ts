import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';

import { notificationRepository } from '@/db/repositories';
import type { NotificationReminder, VehicleDocument } from '@/models';
import { formatDocumentDate } from '@/utils/maintenance';

export const DOCUMENT_REMINDER_DAYS = [30, 14, 7, 1] as const;
export const IS_EXPO_GO = Constants.appOwnership === AppOwnership.Expo;

const EXPIRY_CHANNEL_ID = 'document-expiry-reminders';
type NotificationsModule = typeof import('expo-notifications');

export interface ReminderScheduleResult {
  status:
    | 'scheduled'
    | 'denied'
    | 'unavailable'
    | 'no_future_dates'
    | 'development_build_required';
  scheduledCount: number;
  skippedCount: number;
}

let notificationPresentationConfigured = false;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;

async function getNotificationsModule() {
  if (IS_EXPO_GO) {
    return null;
  }

  notificationsModulePromise ??= import('expo-notifications').catch(() => null);
  return notificationsModulePromise;
}

export async function configureNotificationPresentation() {
  if (notificationPresentationConfigured) {
    return;
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationPresentationConfigured = true;
}

function reminderDate(expiryDate: string, daysBefore: number) {
  const [year, month, day] = expiryDate.split('-').map(Number);
  const date = new Date(year, month - 1, day, 9, 0, 0, 0);
  date.setDate(date.getDate() - daysBefore);
  return date;
}

async function ensureNotificationPermission(Notifications: NotificationsModule) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(EXPIRY_CHANNEL_ID, {
      name: 'Document expiry reminders',
      description: 'Insurance and revenue licence expiry reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelDocumentReminders(reminders: NotificationReminder[]) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  await Promise.allSettled(
    reminders.map((reminder) =>
      Notifications.cancelScheduledNotificationAsync(reminder.notificationIdentifier),
    ),
  );
}

export async function scheduleDocumentReminders(
  document: VehicleDocument,
  reminderDays: readonly number[] = DOCUMENT_REMINDER_DAYS,
): Promise<ReminderScheduleResult> {
  const now = new Date();
  const futureReminders = reminderDays.map((daysBefore) => ({
    daysBefore,
    scheduledFor: reminderDate(document.expiryDate, daysBefore),
  })).filter((reminder) => reminder.scheduledFor.getTime() > now.getTime());
  const skippedCount = reminderDays.length - futureReminders.length;

  if (futureReminders.length === 0) {
    await notificationRepository.replaceForDocument(document.id, []);
    return { status: 'no_future_dates', scheduledCount: 0, skippedCount };
  }

  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    await notificationRepository.replaceForDocument(document.id, []);
    return {
      status: IS_EXPO_GO ? 'development_build_required' : 'unavailable',
      scheduledCount: 0,
      skippedCount,
    };
  }

  try {
    const permissionGranted = await ensureNotificationPermission(Notifications);
    if (!permissionGranted) {
      await notificationRepository.replaceForDocument(document.id, []);
      return { status: 'denied', scheduledCount: 0, skippedCount };
    }

    const scheduled: Array<{
      daysBefore: number;
      notificationIdentifier: string;
      scheduledFor: string;
    }> = [];

    try {
      for (const reminder of futureReminders) {
        const dayLabel = reminder.daysBefore === 1 ? '1 day' : `${reminder.daysBefore} days`;
        const documentLabel =
          document.type === 'INSURANCE' ? 'Insurance' : 'Revenue licence';
        const documentSubject =
          document.type === 'INSURANCE'
            ? document.provider || 'Your vehicle insurance'
            : 'Your revenue licence';
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${documentLabel} expires in ${dayLabel}`,
            body: `${documentSubject} expires on ${formatDocumentDate(document.expiryDate)}.`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              documentId: document.id,
              documentType: document.type,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.scheduledFor,
            channelId: Platform.OS === 'android' ? EXPIRY_CHANNEL_ID : undefined,
          },
        });

        scheduled.push({
          daysBefore: reminder.daysBefore,
          notificationIdentifier: identifier,
          scheduledFor: reminder.scheduledFor.toISOString(),
        });
      }

      await notificationRepository.replaceForDocument(document.id, scheduled);
      return {
        status: 'scheduled',
        scheduledCount: scheduled.length,
        skippedCount,
      };
    } catch {
      await Promise.allSettled(
        scheduled.map((reminder) =>
          Notifications.cancelScheduledNotificationAsync(reminder.notificationIdentifier),
        ),
      );
      await notificationRepository.replaceForDocument(document.id, []);
      return { status: 'unavailable', scheduledCount: 0, skippedCount };
    }
  } catch {
    await notificationRepository.replaceForDocument(document.id, []);
    return { status: 'unavailable', scheduledCount: 0, skippedCount };
  }
}
