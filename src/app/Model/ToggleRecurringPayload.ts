export interface ToggleRecurringPayload {
  isRecurring: boolean;
  recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  interval?: number;
  endDate?: string | null;   // ISO string or null
}