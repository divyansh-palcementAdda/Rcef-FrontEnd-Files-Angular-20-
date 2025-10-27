// src/app/Model/task-request-dto.ts
export interface TaskRequestDTO {
  requestId?: number;
  requestType?: string;       // e.g. "EXTENSION" or "CLOSURE"
  requestDate?: string;
  status?: string;            // e.g. "PENDING", "APPROVED"
  remarks?: string;
}
