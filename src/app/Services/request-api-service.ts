import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';
import { TaskRequestDto } from '../Model/TaskRequestDto';
import { TaskRequestPayload } from '../Model/TaskRequestPayload';


export interface ApproveRequestPayload {
  requestId: number;
  newDueDate?: string; // ISO string: "2025-12-31"
}

// Model/RejectRequestPayload.ts
export interface RejectRequestPayload {
  requestId: number;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class RequestApiService {
  private readonly baseUrl = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  // SINGLE API: create request + upload proofs
  createRequestWithProofs(taskId: number, formData: FormData): Observable<ApiResponse<TaskRequestDto>> {
    return this.http.post<ApiResponse<TaskRequestDto>>(
      `${this.baseUrl}/${taskId}/requests`,
      formData
    );
  }

  // GET requests (already used in task load)
  getRequestsForTask(taskId: number): Observable<ApiResponse<TaskRequestDto[]>> {
    return this.http.get<ApiResponse<TaskRequestDto[]>>(`${this.baseUrl}/${taskId}/requests`);
  }

  // Approve / Reject (unchanged)
// === CORRECTED SERVICE ===
approveRequest(taskId: number, requestId: number, payload: { newDueDate?: string }): Observable<ApiResponse<TaskRequestDto>> {
  const body: ApproveRequestPayload = {
    requestId,                    // MUST include
    newDueDate: payload.newDueDate // optional
  };
  return this.http.patch<ApiResponse<TaskRequestDto>>(
    `${this.baseUrl}/${taskId}/requests/${requestId}/approve`,
    body
  );
}

rejectRequest(taskId: number, requestId: number, reason: string): Observable<ApiResponse<TaskRequestDto>> {
  const body: RejectRequestPayload = {
    requestId,    // MUST include
    reason
  };
  return this.http.patch<ApiResponse<TaskRequestDto>>(
    `${this.baseUrl}/${taskId}/requests/${requestId}/reject`,
    body
  );
}
}