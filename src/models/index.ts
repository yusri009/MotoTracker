export interface Vehicle {
  id: number;
  name: string;
  brand: string;
  model: string;
  registrationNumber: string;
  currentOdometer: number;
  imageUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleInput {
  name: string;
  brand: string;
  model: string;
  registrationNumber: string;
  currentOdometer: number;
  imageUri?: string | null;
}

export interface UpdateVehicleProfileInput {
  name: string;
  brand: string;
  model: string;
  registrationNumber: string;
  imageUri?: string | null;
}

export interface OdometerHistoryEntry {
  id: number;
  vehicleId: number;
  odometer: number;
  recordedAt: string;
  note: string | null;
  createdAt: string;
}

export interface CreateOdometerEntryInput {
  vehicleId: number;
  odometer: number;
  recordedAt?: string;
  note?: string | null;
}

export const MAINTENANCE_TYPES = [
  'OIL_CHANGE',
  'CHAIN_LUBRICATION',
  'SERVICE',
  'TYRE_CHANGE',
  'BRAKE_MAINTENANCE',
  'BATTERY',
  'AIR_FILTER',
  'OTHER',
] as const;

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

export interface MaintenanceRecord {
  id: number;
  vehicleId: number;
  type: MaintenanceType;
  servicedAt: string;
  odometer: number;
  cost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceRecordInput {
  vehicleId: number;
  type: MaintenanceType;
  servicedAt: string;
  odometer: number;
  cost?: number | null;
  notes?: string | null;
}

export const MAINTENANCE_KINDS = ['ENGINE_OIL', 'CHAIN_LUBRICATION'] as const;

export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

export interface MaintenanceSetting {
  id: number;
  vehicleId: number;
  kind: MaintenanceKind;
  lastServiceOdometer: number;
  intervalKm: number;
  lastServiceDate: string;
  dueSoonThresholdKm: number;
  productName: string | null;
  lastServiceCost: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMaintenanceSettingInput {
  vehicleId: number;
  kind: MaintenanceKind;
  lastServiceOdometer: number;
  intervalKm: number;
  lastServiceDate: string;
  dueSoonThresholdKm?: number;
  productName?: string | null;
  lastServiceCost?: number | null;
}

export interface CompleteMaintenanceInput {
  vehicleId: number;
  kind: MaintenanceKind;
  type: MaintenanceType;
  intervalKm: number;
  servicedAt: string;
  dueSoonThresholdKm?: number;
  productName?: string | null;
  cost?: number | null;
  notes?: string | null;
}

export interface CompleteMaintenanceResult {
  setting: MaintenanceSetting;
  record: MaintenanceRecord;
}

export const DOCUMENT_TYPES = ['INSURANCE', 'REVENUE_LICENCE'] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface VehicleDocument {
  id: number;
  vehicleId: number;
  type: DocumentType;
  provider: string | null;
  policyNumber: string | null;
  startDate: string;
  expiryDate: string;
  cost: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveVehicleDocumentInput {
  vehicleId: number;
  type: DocumentType;
  provider?: string | null;
  policyNumber?: string | null;
  startDate: string;
  expiryDate: string;
  cost?: number | null;
}

export interface NotificationReminder {
  id: number;
  documentId: number;
  daysBefore: number;
  notificationIdentifier: string;
  scheduledFor: string;
  createdAt: string;
}

export interface DocumentReminderPreference {
  vehicleId: number;
  documentType: DocumentType;
  daysBefore: number;
  createdAt: string;
}
