export const MEDICATION_FORMS = [
  'Tablet',
  'Capsule',
  'Liquid',
  'Injection',
  'Inhaler',
  'Drops',
  'Topical',
  'Other',
] as const;

export type MedicationForm = (typeof MEDICATION_FORMS)[number];

export type FrequencyType = 'daily' | 'specific_days';

export type DoseActionStatus = 'taken' | 'skipped' | 'snoozed';

export type ComputedDoseStatus =
  | 'taken'
  | 'skipped'
  | 'snoozed'
  | 'overdue'
  | 'due'
  | 'upcoming';

export type DailyPeriod = 'Morning' | 'Afternoon' | 'Evening' | 'Bedtime';

export const SCHEMA_LIMITS = {
  NAME_MAX: 100,
  DOSAGE_MAX: 40,
  INSTRUCTIONS_MAX: 240,
  NOTES_MAX: 240,
  MAX_SCHEDULE_TIMES: 8,
  MIN_QUANTITY: 0,
  MAX_QUANTITY: 10000,
  MAX_REFILL_THRESHOLD: 1000,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  browserNotificationsEnabled: boolean;
  soundAlertsEnabled: boolean;
  reminderLeadMinutes: number;
  snoozeDefaultMinutes: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  instructions: string;
  scheduleTimes: string[];
  frequencyType: FrequencyType;
  daysOfWeek: number[];
  active: boolean;
  trackSupply: boolean;
  remainingQuantity: number;
  refillThreshold: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MedicationInput {
  id?: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  instructions: string;
  scheduleTimes: string[];
  frequencyType: FrequencyType;
  daysOfWeek: number[];
  active: boolean;
  trackSupply: boolean;
  remainingQuantity: number;
  refillThreshold: number;
}

export interface DoseLog {
  id: string;
  userId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  dateKey: string;
  scheduledTime: string;
  status: DoseActionStatus;
  takenAt: string;
  snoozedUntil: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ScheduledDose {
  slotId: string;
  medication: Medication;
  dateKey: string;
  scheduledTime: string;
  period: DailyPeriod;
  status: ComputedDoseStatus;
  log?: DoseLog;
  minutesDelta: number;
}

export interface DailyAdherencePoint {
  dateKey: string;
  label: string;
  scheduled: number;
  taken: number;
  skipped: number;
  rate: number | null;
}

export interface MedicationAdherenceItem {
  medicationId: string;
  name: string;
  dosage: string;
  scheduledCount: number;
  takenCount: number;
  rate: number | null;
}
