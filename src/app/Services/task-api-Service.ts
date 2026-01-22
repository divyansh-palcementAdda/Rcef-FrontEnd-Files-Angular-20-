import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../environment/environment';
import { TaskDto } from '../Model/TaskDto';
import { TaskPayload } from '../Model/TaskPayload';
import { ToggleRecurringPayload } from '../Model/ToggleRecurringPayload'; // ← new model (create it)
import { TaskCreatePayload } from '../Model/TaskCreatePayload';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  status?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TaskApiService {

  private readonly baseUrl = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  // 1. Create Task
  createTask(payload: TaskPayload): Observable<ApiResponse<TaskDto>> {
    return this.http.post<ApiResponse<TaskDto>>(this.baseUrl, payload);
  }

    createTaskRecurring(payload: TaskCreatePayload): Observable<ApiResponse<TaskDto>> {
    return this.http.post<ApiResponse<TaskDto>>(this.baseUrl, payload);
  }
  // In TaskApiService
getRecurredInstances(taskId: number): Observable<ApiResponse<TaskDto[]>> {
  return this.http.get<ApiResponse<TaskDto[]>>(
    `${this.baseUrl}/instances/parent/${taskId}`
  );
}

getInstanceDetails(instanceId: number): Observable<ApiResponse<TaskDto>> {
     return this.http.get<ApiResponse<TaskDto>>(`${this.baseUrl}/${instanceId}`);
}
  // 2. Start Task
  startTask(taskId: number): Observable<ApiResponse<TaskDto>> {
    return this.http.patch<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}/start`, {});
  }
  // In TaskApiService.ts

getAllRecurringParentTasks(): Observable<ApiResponse<TaskDto[]>> {
  console.log('Fetching all recurring parent tasks from API...');
  return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/parents`);
}

getAllRecurredInstanceTasks(): Observable<ApiResponse<TaskDto[]>> {
  return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/instances/all`);
}

// Optional - for future parent → instances view
getRecurredInstancesByParent(parentTaskId: number): Observable<ApiResponse<TaskDto[]>> {
  return this.http.get<ApiResponse<TaskDto[]>>(
    `${this.baseUrl}/instances/parent/${parentTaskId}`
  );
}

  // 3. Get Tasks by Department
  getTasksByDepartment(deptId: number): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/department/${deptId}`);
  }

  // 4. Update Task (full update)
  updateTask(taskId: number, payload: TaskPayload): Observable<ApiResponse<TaskDto>> {
    return this.http.put<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}`, payload);
  }

  // 5. Manually generate next recurring instance (Admin only)
  generateNextInstance(taskId: number): Observable<ApiResponse<TaskDto>> {
    return this.http.post<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}/generate-instance`, {});
  }

  // 6. Delete Task (Admin only)
  deleteTask(taskId: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${taskId}`);
  }

  // 7. Get Task by ID
  getTaskById(taskId: number): Observable<ApiResponse<TaskDto>> {
    return this.http.get<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}`);
  }

  // 8. Get Tasks assigned to User
  getTasksByUser(userId: number): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/user/${userId}`);
  }

  // 9. Get Tasks by Status
  getTasksByStatus(status: string): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/status/${status}`);
  }

  // 10. Get All Tasks
  getAllTasks(): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(this.baseUrl);
  }

  // 11. Get Tasks Requiring Approval
  getAllTasksWhichRequriesApproval(): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/approval`);
  }

  // 12. Approve Task
  approveTask(taskId: number): Observable<ApiResponse<TaskDto>> {
    return this.http.put<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}/approve`, {});
  }

  // 13. Reject Task (with optional reason)
  rejectTask(taskId: number, reason?: string): Observable<ApiResponse<TaskDto>> {
    let params = new HttpParams();
    if (reason) {
      params = params.set('reason', reason);
    }
    return this.http.put<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}/reject`, {}, { params });
  }

  // 14. Toggle Recurring (new - very important for your feature)
  toggleRecurring(taskId: number, payload: ToggleRecurringPayload): Observable<ApiResponse<TaskDto>> {
    return this.http.patch<ApiResponse<TaskDto>>(
      `${this.baseUrl}/${taskId}/toggle-recurring`,
      payload
    );
  }

  // ──────────────────────────────────────────────────────────────
  //          Error Handling (improved version)
  // ──────────────────────────────────────────────────────────────
  private handleError(error: any, context: string): Observable<never> {
    console.error(`Error during ${context}:`, error);

    let userMessage = 'An unexpected error occurred. Please try again later.';

    if (!error.status) {
      userMessage = 'Cannot reach the server. Check your internet connection.';
    } else if (error.status === 0) {
      userMessage = 'Backend service unavailable.';
    } else if (error.status === 400) {
      userMessage = error.error?.message || 'Invalid request. Please check your input.';
    } else if (error.status === 401) {
      userMessage = 'Session expired. Please login again.';
    } else if (error.status === 403) {
      userMessage = 'You do not have permission to perform this action.';
    } else if (error.status === 404) {
      userMessage = 'The requested resource was not found.';
    } else if (error.status >= 500) {
      userMessage = 'Server error occurred. Our team has been notified.';
    }

    return throwError(() => ({
      success: false,
      message: userMessage,
      backendMessage: error.error?.message || 'No details available',
      status: error.status
    }));
  }
}