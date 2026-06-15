import { RoleDTO } from "./role-dto";
import { TaskProofDto } from "./TaskProofDto";

export interface TaskRequestDto {
  /** PK from task_requests.requestId */
  requestId: number;

  taskId: number;
  taskTitle: string;

  /** CLOSURE | EXTENSION */
  requestType: 'CLOSURE' | 'EXTENSION';

  /** ISO‑8601 string (e.g. "2025-11-05T10:30:00") */
  requestDate: string;

  /** PENDING | APPROVED | REJECTED */
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  /** Optional free‑text remarks */
  remarks?: string;

  /** User who created the request */
  requestedById: number;               // userId
  requestedByName?: string;  
  requestedByRole: RoleDTO;        // populated by backend for convenience

  /** Approver (only when status = APPROVED/REJECTED) */
  approvedBy?: number;               // userId
  approvedByName?: string;           // populated by backend

  /** One‑to‑many proofs belonging to this request */
  proofs?: TaskProofDto[];
  structuredProof?: any;
  structuredProofs?: StructuredProofValueDto[];
}

export interface StructuredProofValueDto {
  proofTypeId: number;
  proofTypeName: string;
  fieldType: string;
  value: string;
}

