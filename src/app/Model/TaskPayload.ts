// src/app/Model/TaskPayload.ts
import { TaskStatus } from './TaskStatus';

export interface TaskPayload {
  /** 📝 Task title */
  title: string;

  /** 📄 Task description or notes */
  description?: string;

  /** ⏰ Deadline date (ISO format recommended) */
  dueDate?: string; // Backend expects LocalDateTime → send ISO string

  /** ⏰ Start date (ISO format recommended, required for UPCOMING) */
  startDate?: string;

  /** 👤 Assigned user ID (optional for unassigned tasks) */
  assignedToId?: number;

  /** 🏢 Department ID (required) */
  // departmentId: number;

  /** ✅ Whether this task requires approval (e.g. created by HOD) */
  requiresApproval?: boolean;

  /** 📌 Current task status (e.g., PENDING, COMPLETED, etc.) */
  status?: TaskStatus;
}