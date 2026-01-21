// src/app/tasks/models/task-create-payload.ts
export interface TaskCreatePayload {
  title: string;
  description?: string;
  startDate?: string;           // ISO string e.g. "2026-01-25T10:00:00"
  dueDate: string;              // required
  status: 'PENDING';

  assignedToIds?: number[];
  departmentIds?: number[];

  requiresApproval?: boolean;

  isRecurring?: boolean;
  recurrenceType?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  interval?: number;
  endDate?: string | null;      // renamed from recurrenceEndDate
}