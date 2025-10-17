import { TaskStatus } from './TaskStatus';


export interface TaskDto {
  taskId: number;
  title: string;
  description?: string;
  startDate?: string; // ISO 8601 date string
  dueDate: string; // ISO 8601 date string
  status: TaskStatus;

  createdById?: number;
  createdByName?: string;

  // ✅ Multi-user and department support
  assignedToIds?: number[];      // IDs of users assigned to the task
  assignedToNames?: string[];    // Names of users assigned to the task

  departmentIds?: number[];      // IDs of associated departments
  departmentNames?: string[];    // Names of associated departments

  // ✅ Task lifecycle flags
  requiresApproval?: boolean;
  approved?: boolean;
  rfcCompletedAt?: string;       // ISO 8601 date string (nullable)

  // ✅ Related entities
  // proofs?: TaskProofDto[];
  // requests?: TaskRequestDto[];
}