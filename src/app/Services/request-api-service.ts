// src/app/core/services/request-api.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';
import { TaskRequestDto } from '../Model/TaskRequestDto';

// Payloads
export interface ApproveRequestPayload {
  requestId: number;
  newDueDate?: string; // "2025-12-31"
}

export interface RejectRequestPayload {
  requestId: number;
  reason: string;
}

@Injectable({
  providedIn: 'root'
})
export class RequestApiService {

  // CORRECT BASE URL: points to task-requests, not tasks
  private readonly baseUrl = `${environment.apiUrl}/task-requests`;

  constructor(private http: HttpClient) {}

  // CREATE request with proofs (multipart/form-data)
  createRequestWithProofs(taskId: number, formData: FormData): Observable<ApiResponse<TaskRequestDto>> {
    return this.http.post<ApiResponse<TaskRequestDto>>(
      `${environment.apiUrl}/tasks/${taskId}/requests`,
      formData
    );
  }

  // GET all requests for a specific task (used in task detail page)
  getRequestsForTask(taskId: number): Observable<ApiResponse<TaskRequestDto[]>> {
    return this.http.get<ApiResponse<TaskRequestDto[]>>(`${environment.apiUrl}/tasks/${taskId}/requests`);
  }

  // APPROVE request (PATCH)
  approveRequest(taskId: number, requestId: number, payload: { newDueDate?: string }): Observable<ApiResponse<TaskRequestDto>> {
    const body: ApproveRequestPayload = {
      requestId,
      newDueDate: payload.newDueDate
    };

    return this.http.patch<ApiResponse<TaskRequestDto>>(
      `${environment.apiUrl}/tasks/${taskId}/requests/${requestId}/approve`,
      body
    );
  }

  // REJECT request (PATCH)
  rejectRequest(taskId: number, requestId: number, reason: string): Observable<ApiResponse<TaskRequestDto>> {
    const body: RejectRequestPayload = { requestId, reason };

    return this.http.patch<ApiResponse<TaskRequestDto>>(
      `${environment.apiUrl}/tasks/${taskId}/requests/${requestId}/reject`,
      body
    );
  }

  // ROLE-BASED LIST ENDPOINTS — ALL RETURN SAME DTO & WRAPPER

  /** ADMIN: View all requests in the system */
  getAllRequests(): Observable<ApiResponse<TaskRequestDto[]>> {
    return this.http.get<ApiResponse<TaskRequestDto[]>>(`${this.baseUrl}/all`);
  }

  /** HOD: View requests from teachers in his/her department(s) */
  getRequestsByHodDepartments(): Observable<ApiResponse<TaskRequestDto[]>> {
    return this.http.get<ApiResponse<TaskRequestDto[]>>(`${this.baseUrl}/hod`);
  }

  /** TEACHER: View only own submitted requests */
  getMyRequests(): Observable<ApiResponse<TaskRequestDto[]>> {
    return this.http.get<ApiResponse<TaskRequestDto[]>>(`${this.baseUrl}/my`);
  }

  /** Optional: Get single request by ID */
  getRequestById(requestId: number): Observable<ApiResponse<TaskRequestDto>> {
    return this.http.get<ApiResponse<TaskRequestDto>>(`${this.baseUrl}/${requestId}`);
  }
}