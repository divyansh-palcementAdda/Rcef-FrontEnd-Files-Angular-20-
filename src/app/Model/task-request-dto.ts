// src/app/Model/task-request-dto.ts
export interface TaskRequestDTO {
  requestId?: number;
  taskId?: number;
  taskTitle?: string;
  taskDueDate?: string;
  requestType?: string;       // e.g. "EXTENSION" or "CLOSURE"
  requestDate?: string;
  requestedDueDate?: string;  // e.g. "2026-11-05T00:00:00"
  status?: string;            // e.g. "PENDING", "APPROVED"
  remarks?: string;
  requestedByName?: string;
  requestedByRole?: any;
  approvedByName?: string;
  proofs?: any[];
  structuredProofs?: any[];
}
