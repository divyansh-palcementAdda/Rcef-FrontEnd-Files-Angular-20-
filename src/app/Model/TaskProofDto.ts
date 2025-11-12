export interface TaskProofDto {
  /** PK from task_proofs.proofId */
  proofId: number;

  /** Full URL (http(s)://…) */
  fileUrl: string;

  /** MIME type or short description (e.g. "image/jpeg") */
  fileType: string;

  /** User who uploaded the proof */
  uploadedById: number;
  uploadedByName: string;

  /** ISO‑8601 string (e.g. "2025-11-05T10:35:00") */
  uploadedAt: string;
}