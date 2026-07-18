// src/app/core/services/request-api.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';
import { TaskRequestDto } from '../Model/TaskRequestDto';

// Payloads
export interface ApproveRequestPayload {
  requestId: number;
  newDueDate?: string; // "2025-12-31"
  remarks?: string;
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

  // APPROVE request (PATCH) - legacy
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

  // REJECT request (PATCH) - legacy
  rejectRequest(taskId: number, requestId: number, reason: string): Observable<ApiResponse<TaskRequestDto>> {
    const body: RejectRequestPayload = { requestId, reason };

    return this.http.patch<ApiResponse<TaskRequestDto>>(
      `${environment.apiUrl}/tasks/${taskId}/requests/${requestId}/reject`,
      body
    );
  }

  // Paginated search and filtering
  searchRequests(params: any): Observable<ApiResponse<any>> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      const val = params[key];
      if (val !== null && val !== undefined && val !== '') {
        httpParams = httpParams.set(key, val.toString());
      }
    });
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/search`, { params: httpParams });
  }

  // Export to CSV
  exportRequests(params: any): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      const val = params[key];
      if (val !== null && val !== undefined && val !== '') {
        httpParams = httpParams.set(key, val.toString());
      }
    });
    return this.http.get(`${this.baseUrl}/export`, {
      params: httpParams,
      responseType: 'blob'
    });
  }

  // Direct approve endpoint
  approveRequestDirect(requestId: number, body: ApproveRequestPayload): Observable<ApiResponse<TaskRequestDto>> {
    return this.http.patch<ApiResponse<TaskRequestDto>>(`${this.baseUrl}/${requestId}/approve`, body);
  }

  // Direct reject endpoint
  rejectRequestDirect(requestId: number, body: RejectRequestPayload): Observable<ApiResponse<TaskRequestDto>> {
    return this.http.patch<ApiResponse<TaskRequestDto>>(`${this.baseUrl}/${requestId}/reject`, body);
  }

  // Delete request
  deleteRequest(requestId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${requestId}`);
  }

  /** Optional: Get single request by ID */
  getRequestById(requestId: number): Observable<ApiResponse<TaskRequestDto>> {
    return this.http.get<ApiResponse<TaskRequestDto>>(`${this.baseUrl}/${requestId}`);
  }
}