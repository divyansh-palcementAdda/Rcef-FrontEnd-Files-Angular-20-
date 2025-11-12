import { TaskProofDto } from "./TaskProofDto";

export interface TaskRequestDto {
  /** PK from task_requests.requestId */
  requestId: number;

  /** CLOSURE | EXTENSION */
  requestType: 'CLOSURE' | 'EXTENSION';

  /** ISO‑8601 string (e.g. "2025-11-05T10:30:00") */
  requestDate: string;

  /** PENDING | APPROVED | REJECTED */
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  /** Optional free‑text remarks */
  remarks?: string;

  /** User who created the request */
  requestedBy: number;               // userId
  requestedByName?: string;          // populated by backend for convenience

  /** Approver (only when status = APPROVED/REJECTED) */
  approvedBy?: number;               // userId
  approvedByName?: string;           // populated by backend

  /** One‑to‑many proofs belonging to this request */
  proofs?: TaskProofDto[];
}
