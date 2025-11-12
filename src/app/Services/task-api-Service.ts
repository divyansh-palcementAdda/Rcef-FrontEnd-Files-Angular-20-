import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { TaskDto } from '../Model/TaskDto';
import { TaskPayload } from '../Model/TaskPayload';
import { environment } from '../environment/environment';



@Injectable({
  providedIn: 'root'
})
export class TaskApiService {

  private readonly baseUrl = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}


  
getTasksByDepartment(deptId: number): Observable<{data: TaskDto[]}> {
  return this.http.get<{data: TaskDto[]}>(`${this.baseUrl}/department/${deptId}`);
}
startTask(taskId: number): Observable<ApiResponse<TaskDto>> {
  return this.http.patch<ApiResponse<TaskDto>>(
    `${this.baseUrl}/${taskId}/start`,
    {} // empty body
  );
}

  /** CREATE TASK */
  createTask(payload: TaskPayload): Observable<ApiResponse<TaskDto>> {
    return this.http.post<ApiResponse<TaskDto>>(`${this.baseUrl}`, payload).pipe(
      catchError(err => this.handleError(err, 'creating the task'))
    );
  }

  /** UPDATE TASK */
  updateTask(taskId: number, payload: TaskPayload): Observable<ApiResponse<TaskDto>> {
    return this.http.put<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}`, payload).pipe(
      catchError(err => this.handleError(err, 'updating the task'))
    );
  }

  /** DELETE TASK */
  deleteTask(taskId: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${taskId}`).pipe(
      catchError(err => this.handleError(err, 'deleting the task'))
    );
  }

  

  /** GET TASK BY ID */
  getTaskById(taskId: number): Observable<ApiResponse<TaskDto>> {
    return this.http.get<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}`).pipe(
      catchError(err => this.handleError(err, 'fetching task details'))
    );
  }

  /** GET TASKS BY USER */
  getTasksByUser(userId: number): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/user/${userId}`).pipe(
      catchError(err => this.handleError(err, 'fetching user tasks'))
    );
  }
  getAllTasksWhichRequriesApproval(): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/approval`).pipe(
      catchError(err => this.handleError(err, 'fetching approval tasks'))
    );
  }
  /** GET TASKS BY STATUS */
  getTasksByStatus(status: string): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}/status/${status}`).pipe(
      catchError(err => this.handleError(err, `fetching tasks by status "${status}"`))
    );
  }

  /** GET ALL TASKS */
  getAllTasks(): Observable<ApiResponse<TaskDto[]>> {
    return this.http.get<ApiResponse<TaskDto[]>>(`${this.baseUrl}`).pipe(
      catchError(err => this.handleError(err, 'fetching all tasks'))
    );
  }

  /** APPROVE TASK */
  approveTask(taskId: number): Observable<ApiResponse<TaskDto>> {
    return this.http.put<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}/approve`, {}).pipe(
      catchError(err => this.handleError(err, 'approving the task'))
    );
  }


  /** REJECT TASK */
  rejectTask(taskId: number, reason: string): Observable<ApiResponse<TaskDto>> {
    return this.http.put<ApiResponse<TaskDto>>(`${this.baseUrl}/${taskId}/reject`, null, { params: { reason } }).pipe(
      catchError(err => this.handleError(err, 'rejecting the task'))
    );
  }

  /** Unified error handler */
  private handleError(error: any, context: string): Observable<never> {
    console.error(`Error ${context}:`, error);

    let uiMessage = 'An unexpected error occurred. Please try again.';
    const backendMessage = error?.error?.message?.toLowerCase?.();

    if (!error.status) {
      uiMessage = '🚫 Server is unreachable. Please check your connection.';
    } 
    else if (error.status === 0) {
      uiMessage = '⚠️ Backend service unavailable. Try again later.';
    } 
    else if (error.status === 401) {
      uiMessage = '🔒 Unauthorized! Please log in again.';
    } 
    else if (error.status === 403) {
      uiMessage = '🚫 Access denied! You are not authorized for this action.';
    } 
    else if (error.status === 404) {
      uiMessage = '🔍 Requested resource not found.';
    } 
    else if (error.status === 400 && backendMessage?.includes('invalid')) {
      uiMessage = '⚠️ Invalid input! Please check your fields.';
    } 
    else if (backendMessage?.includes('not found')) {
      uiMessage = '❌ The requested item was not found.';
    } 
    else if (backendMessage?.includes('already exists')) {
      uiMessage = '⚠️ Duplicate entry! Item already exists.';
    } 
    else if (backendMessage?.includes('database') || backendMessage?.includes('constraint')) {
      uiMessage = '⚠️ Database error occurred.';
    } 
    else if (backendMessage?.includes('forbidden')) {
      uiMessage = '🚫 You do not have permission to perform this action.';
    }

    return throwError(() => ({
      success: false,
      message: uiMessage,
      backendMessage: error?.error?.message || 'No backend message provided',
      status: error.status
    }));
  }
}