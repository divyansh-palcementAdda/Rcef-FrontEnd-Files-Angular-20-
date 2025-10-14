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

  /** ✅ Create a new task (Admin/HOD only) */
  createTask(payload: TaskPayload): Observable<{ success: boolean; message: string; data?: TaskDto }> {
    return this.http.post<TaskDto>(`${this.baseUrl}`, payload).pipe(
      map(res => ({
        success: true,
        message: '✅ Task created successfully.',
        data: res
      })),
      catchError(err => this.handleError(err, 'creating the task'))
    );
  }

  /** ✏️ Update task details */
  updateTask(taskId: number, payload: TaskPayload): Observable<{ success: boolean; message: string; data?: TaskDto }> {
    return this.http.put<TaskDto>(`${this.baseUrl}/${taskId}`, payload).pipe(
      map(res => ({
        success: true,
        message: '✅ Task updated successfully.',
        data: res
      })),
      catchError(err => this.handleError(err, 'updating the task'))
    );
  }

  /** ❌ Delete a task (Admin only) */
  deleteTask(taskId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<void>(`${this.baseUrl}/${taskId}`).pipe(
      map(() => ({
        success: true,
        message: '🗑️ Task deleted successfully.'
      })),
      catchError(err => this.handleError(err, 'deleting the task'))
    );
  }

  /** 🔍 Get task by ID */
  getTaskById(taskId: number): Observable<{ success: boolean; message: string; data?: TaskDto }> {
    return this.http.get<TaskDto>(`${this.baseUrl}/${taskId}`).pipe(
      map(res => ({
        success: true,
        message: '✅ Task fetched successfully.',
        data: res
      })),
      catchError(err => this.handleError(err, 'fetching the task details'))
    );
  }

  /** 👤 Get tasks by assigned user */
  getTasksByUser(userId: number): Observable<{ success: boolean; message: string; data?: TaskDto[] }> {
    console.log("fetching task by user user id ",userId)
    return this.http.get<TaskDto[]>(`${this.baseUrl}/user/${userId}`).pipe(
      map(res => ({
        success: true,
        message: `✅ ${res.length} tasks found for the user.`,
        data: res
      })),
      catchError(err => this.handleError(err, 'fetching user tasks'))
    );
  }

  /** 🏢 Get tasks by department */
  getTasksByDepartment(departmentId: number): Observable<{ success: boolean; message: string; data?: TaskDto[] }> {
    return this.http.get<TaskDto[]>(`${this.baseUrl}/department/${departmentId}`).pipe(
      map(res => ({
        success: true,
        message: `✅ ${res.length} department tasks found.`,
        data: res
      })),
      catchError(err => this.handleError(err, 'fetching department tasks'))
    );
  }

  /** 📋 Get all tasks */
  getAllTasks(): Observable<{ success: boolean; message: string; data?: TaskDto[] }> {
    return this.http.get<TaskDto[]>(`${this.baseUrl}`).pipe(
      map(res => ({
        success: true,
        message: `✅ ${res.length} tasks fetched successfully.`,
        data: res
      })),
      catchError(err => this.handleError(err, 'fetching all tasks'))
    );
  }

  /** ⏳ Get tasks filtered by status */
  getTasksByStatus(status: string): Observable<{ success: boolean; message: string; data?: TaskDto[] }> {
    return this.http.get<TaskDto[]>(`${this.baseUrl}/status/${status}`).pipe(
      map(res => ({
        success: true,
        message: `✅ ${res.length} "${status}" tasks found.`,
        data: res
      })),
      catchError(err => this.handleError(err, 'fetching tasks by status'))
    );
  }

  /** ✅ Approve task (Admin/HOD) */
  approveTask(taskId: number): Observable<{ success: boolean; message: string; data?: TaskDto }> {
    return this.http.post<TaskDto>(`${this.baseUrl}/${taskId}/approve`, {}).pipe(
      map(res => ({
        success: true,
        message: '✅ Task approved successfully.',
        data: res
      })),
      catchError(err => this.handleError(err, 'approving the task'))
    );
  }

  /** ❌ Reject task (Admin/HOD) */
  rejectTask(taskId: number, reason: string): Observable<{ success: boolean; message: string; data?: TaskDto }> {
    return this.http.post<TaskDto>(`${this.baseUrl}/${taskId}/reject`, { reason }).pipe(
      map(res => ({
        success: true,
        message: '❌ Task rejected successfully.',
        data: res
      })),
      catchError(err => this.handleError(err, 'rejecting the task'))
    );
  }

  /** ⚠️ Unified Error Handler — maps backend error → user-friendly UI message */
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
