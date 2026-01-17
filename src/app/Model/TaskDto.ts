import { Department } from './department';
import { TaskProofDto } from './TaskProofDto';
import { TaskRequestDto } from './TaskRequestDto';
import { TaskStatus } from './TaskStatus';
import { userDto } from './userDto';
export type RecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;

export interface TaskDto {
  taskId: number;
  title: string;
  description?: string;
  startDate: string; // ISO 8601 date string
  dueDate: string; // ISO 8601 date string
  status: TaskStatus;

  createdById?: number;
  createdByName?: string;

  // ✅ Multi-user and department support
  assignedToIds?: number[];      // IDs of users assigned to the task
  assignedToNames?: string[];    // Names of users assigned to the task

  departmentIds?: number[];      // IDs of associated departments
  departmentNames?: string[];    // Names of associated departments

  startedAt?: string;
  startedById?: number;              // WHO started
  startedByName?: string;

  isRecurring?: boolean;
recurrenceType?: RecurrenceType; // 'DAILY' | 'WEEKLY' | 'MONTHLY'
interval?: number;
endDate?: string; // ISO 8601 date string
parentTaskId?: number; // For recurring instances


  // ✅ Task lifecycle flags
  requiresApproval?: boolean;
  approved?: boolean;
  rfcCompletedAt?: string;       // ISO 8601 date string (nullable)
  assignedUsers?: userDto[];
  departments?: Department[];
  // ✅ Related entities
  proofs?: TaskProofDto[];
  requests?: TaskRequestDto[];
}