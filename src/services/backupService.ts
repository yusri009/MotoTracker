import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDatabase } from '@/db/database';

const backupDirectory = new Directory(Paths.cache, 'mototracker-backups');

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function tableRows(table: string) {
  const database = await getDatabase();
  return database.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
}

export const backupService = {
  async exportAllData() {
    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      throw new Error('File sharing is not available on this device.');
    }

    const [
      vehicles,
      odometerHistory,
      maintenanceRecords,
      maintenanceSettings,
      documents,
      reminderPreferences,
      appSettings,
    ] = await Promise.all([
      tableRows('vehicles'),
      tableRows('odometer_history'),
      tableRows('maintenance_records'),
      tableRows('maintenance_settings'),
      tableRows('documents'),
      tableRows('document_reminder_preferences'),
      tableRows('app_settings'),
    ]);

    const backup = {
      format: 'mototracker-backup',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      note: 'Vehicle image files and device-specific scheduled notification identifiers are not embedded.',
      data: {
        vehicles,
        odometerHistory,
        maintenanceRecords,
        maintenanceSettings,
        documents,
        reminderPreferences,
        appSettings,
      },
    };

    if (!backupDirectory.exists) {
      backupDirectory.create({ idempotent: true, intermediates: true });
    }

    const filename = `mototracker-backup-${safeTimestamp()}.json`;
    const file = new File(backupDirectory, filename);
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify(backup, null, 2));

    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Export MotoTracker backup',
      mimeType: 'application/json',
      UTI: 'public.json',
    });

    return {
      filename,
      vehicleCount: vehicles.length,
      maintenanceRecordCount: maintenanceRecords.length,
      documentCount: documents.length,
    };
  },
};
