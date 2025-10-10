import { TaskStatus } from "./TaskStatus";

export interface TaskDto {
  taskId: number;
  title: string;
  description?: string;
  dueDate: string; // ISO date string
  status: TaskStatus; // TaskStatus enum values
  assignedToName: string; // ID of the user the task is assigned to
  createdByUserId: number; // ID of the user who created the task
  departmentName: string; // ID of the department
}