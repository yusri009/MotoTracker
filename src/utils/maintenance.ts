export type DashboardStatus =
  | 'NORMAL'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'EXPIRED'
  | 'UNCONFIGURED';

export interface KmMaintenanceCalculation {
  nextServiceKm: number;
  remainingKm: number;
  status: Extract<DashboardStatus, 'NORMAL' | 'DUE_SOON' | 'OVERDUE'>;
}

export interface DateExpiryCalculation {
  daysRemaining: number;
  status: Extract<DashboardStatus, 'NORMAL' | 'DUE_SOON' | 'EXPIRED'>;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    throw new RangeError(`Invalid date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date: ${value}`);
  }

  return timestamp;
}

function localDateAsUtc(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateKmMaintenance(
  currentOdometer: number,
  lastServiceOdometer: number,
  intervalKm: number,
  dueSoonThresholdKm = 300,
): KmMaintenanceCalculation {
  if (
    !Number.isFinite(currentOdometer) ||
    !Number.isFinite(lastServiceOdometer) ||
    !Number.isFinite(intervalKm) ||
    !Number.isFinite(dueSoonThresholdKm) ||
    currentOdometer < 0 ||
    lastServiceOdometer < 0 ||
    intervalKm <= 0 ||
    dueSoonThresholdKm < 0
  ) {
    throw new RangeError('Maintenance calculation requires valid non-negative distances.');
  }

  const nextServiceKm = lastServiceOdometer + intervalKm;
  const remainingKm = nextServiceKm - currentOdometer;
  const status =
    remainingKm <= 0 ? 'OVERDUE' : remainingKm <= dueSoonThresholdKm ? 'DUE_SOON' : 'NORMAL';

  return { nextServiceKm, remainingKm, status };
}

export function calculateDateExpiry(
  expiryDate: string,
  today = new Date(),
  dueSoonThresholdDays = 30,
): DateExpiryCalculation {
  if (!Number.isFinite(dueSoonThresholdDays) || dueSoonThresholdDays < 0) {
    throw new RangeError('Due-soon threshold must be non-negative.');
  }

  const daysRemaining = Math.round(
    (parseDateOnly(expiryDate) - localDateAsUtc(today)) / MILLISECONDS_PER_DAY,
  );
  const status =
    daysRemaining <= 0 ? 'EXPIRED' : daysRemaining <= dueSoonThresholdDays ? 'DUE_SOON' : 'NORMAL';

  return { daysRemaining, status };
}

export function formatKilometres(value: number) {
  return Math.abs(value).toLocaleString('en-US');
}

export function describeRemainingKm(remainingKm: number) {
  if (remainingKm > 0) {
    return `${formatKilometres(remainingKm)} km remaining`;
  }

  if (remainingKm === 0) {
    return 'Due now';
  }

  return `${formatKilometres(remainingKm)} km overdue`;
}

export function describeDaysRemaining(daysRemaining: number) {
  if (daysRemaining > 1) {
    return `${daysRemaining} days remaining`;
  }

  if (daysRemaining === 1) {
    return '1 day remaining';
  }

  if (daysRemaining === 0) {
    return 'Expires today';
  }

  const elapsed = Math.abs(daysRemaining);
  return elapsed === 1 ? 'Expired 1 day ago' : `Expired ${elapsed} days ago`;
}

export function formatDocumentDate(value: string) {
  const timestamp = parseDateOnly(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(timestamp));
}

