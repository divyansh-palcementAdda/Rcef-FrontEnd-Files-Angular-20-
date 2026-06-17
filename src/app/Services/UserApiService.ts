import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { userDto } from '../Model/userDto';

export interface TemplateTaskSummaryDto {
  templateId?: number;       // optional template ID
  templateTitle: string;     // e.g. "Visits Task", "Meeting Task" — from API
  count: number;             // normalized total (mapped from totalTasks or count)
  totalTasks?: number;       // raw field name returned by the API
  statusBreakdown?: Record<string, number>; // e.g. { PENDING: 0, IN_PROGRESS: 1, ... }
  tasks?: any[];             // optional embedded task list
}

@Injectable({
  providedIn: 'root'
})
export class UserApiService {


  private apiUrl = `${environment.apiUrl}/user`; // <-- correct base

  constructor(private http: HttpClient) { }

  getAllUsers(): Observable<userDto[]> {
    console.log('Fetching all users from:', this.apiUrl);
    return this.http.get<userDto[]>(this.apiUrl).pipe(
      catchError(err => this.handleError(err, 'fetch all users'))
    );
  }
  updateUser(userId: number, payload: any) {
    return this.http.put(`${this.apiUrl}/${userId}`, payload);
  }

  createUser(payload: any): Observable<any> {
    console.log('Creating user with payload:', payload);
    return this.http.post(`${environment.apiUrl}/auth/register`, payload).pipe(
      catchError(err => this.handleError(err, 'create user'))
    );
  }

  getAllUsersByStatus(status: string): Observable<userDto[]> {
    console.log('Fetching users with status:', status);
    return this.http.get<userDto[]>(`${this.apiUrl}/status/${status}`).pipe(
      catchError(err => this.handleError(err, 'fetch users by status'))
    );
  }

  getAllUsersByDepartment(departmentId: number): Observable<userDto[]> {
    console.log('Fetching users for department ID:', departmentId);
    return this.http.get<userDto[]>(`${this.apiUrl}/department/${departmentId}`).pipe(
      catchError(err => this.handleError(err, 'fetch users by department'))
    );
  }

  getUserById(userId: number): Observable<userDto> {
    console.log('Fetching user with ID:', userId);
    return this.http.get<userDto>(`${this.apiUrl}/${userId}`).pipe(
      catchError(err => this.handleError(err, 'fetch user by ID'))
    );
  }

  deleteUser(userId: number): Observable<any> {
    console.log('Deleting user with ID:', userId);
    return this.http.delete(`${this.apiUrl}/${userId}`).pipe(
      catchError(err => this.handleError(err, 'delete user'))
    );
  }

  /**
   * GET /api/user/{userId}/template-task-summary
   * Handles both plain-array and { data: [...] } wrapped responses.
   */
  getUserTaskTemplateSummary(userId: number): Observable<TemplateTaskSummaryDto[]> {
    return this.http.get<any>(
      `${this.apiUrl}/${userId}/template-task-summary`
    ).pipe(
      map((res: any) => {
        // Shape 1: plain array  →  [ { templateTitle, totalTasks, ... }, ... ]
        if (Array.isArray(res)) return this.normalizeTypeSummary(res);

        // Shape 2: { data: [...] }
        if (res && Array.isArray(res.data)) return this.normalizeTypeSummary(res.data);

        // Shape 3 (actual API): { userId, userName, totalTemplateTasks, templateBreakdown: [...] }
        if (res && Array.isArray(res.templateBreakdown)) return this.normalizeTypeSummary(res.templateBreakdown);

        return [];
      }),
      catchError(err => this.handleError(err, 'fetch user task template summary'))
    );
  }

  /** Normalise each item so count = totalTasks ?? count (whichever is present) */
  private normalizeTypeSummary(items: any[]): TemplateTaskSummaryDto[] {
    return items.map(item => ({
      ...item,
      count: item.totalTasks ?? item.count ?? 0,
    }));
  }


  toggleUserStatus(userId: number): Observable<{ success: boolean; message: string }> {

    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/${userId}/toggle-status`,
      {}
    ).pipe(
      catchError(err => this.handleError(err, 'toggle user status'))
    );
  }

  /** POST: { ids: [1,2,3] } → returns userDto[] */
  getUsersByIds(ids: number[]): Observable<userDto[]> {
    if (!ids || ids.length === 0) {
      return of([]);
    }
    return this.http.post<userDto[]>(`${this.apiUrl}/by-ids`, { ids }).pipe(
      catchError(err => this.handleError(err, 'fetch users by IDs'))
    );
  }

  /**
   * Fetch users for multiple departments
   * Returns deduplicated array
   */
  getUsersByDepartments(deptIds: number[]): Observable<userDto[]> {
    if (!deptIds || deptIds.length === 0) {
      return of([]);
    }

    const requests = deptIds.map(id =>
      this.getAllUsersByDepartment(id).pipe(
        catchError(err => {
          console.error(`Failed to load users for department ${id}`, err);
          return of([]);
        })
      )
    );

    return forkJoin(requests).pipe(
      map(results => {
        const merged: userDto[] = [];
        const seen = new Set<number>();
        results.flat().forEach(user => {
          if (!seen.has(user.userId)) {
            seen.add(user.userId);
            merged.push(user);
          }
        });
        return merged;
      })
    );
  }

  // ---------------- Role & Permission APIs ----------------
  getAllRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/roles`).pipe(
      catchError(err => this.handleError(err, 'fetch all roles'))
    );
  }

  getRoleById(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/roles/${id}`).pipe(
      catchError(err => this.handleError(err, 'fetch role by ID'))
    );
  }

  createRoleEntity(payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/roles`, payload).pipe(
      catchError(err => this.handleError(err, 'create role'))
    );
  }

  updateRole(id: string, payload: any): Observable<any> {
    return this.http.put(`${environment.apiUrl}/roles/${id}`, payload).pipe(
      catchError(err => this.handleError(err, 'update role'))
    );
  }

  updateRolePermissions(id: string, permissionCodes: string[]): Observable<any> {
    return this.http.put(`${environment.apiUrl}/roles/${id}/permissions`, permissionCodes).pipe(
      catchError(err => this.handleError(err, 'update role permissions'))
    );
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/roles/${id}`).pipe(
      catchError(err => this.handleError(err, 'delete role'))
    );
  }

  getAllPermissions(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/permissions`).pipe(
      catchError(err => this.handleError(err, 'fetch all permissions'))
    );
  }

  getAdminPermissions(adminId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/admin-permissions/admin/${adminId}`).pipe(
      catchError(err => this.handleError(err, 'fetch admin permissions'))
    );
  }

  configureAdminPermission(payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/admin-permissions/configure`, payload).pipe(
      catchError(err => this.handleError(err, 'configure admin permission'))
    );
  }

  deleteAdminPermission(adminId: number, code: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/admin-permissions/admin/${adminId}/permission/${code}`).pipe(
      catchError(err => this.handleError(err, 'delete admin permission override'))
    );
  }

  // -------------------------------------------------
  private handleError(error: any, context: string) {
    console.error(`Error in ${context}:`, error);
    const message = error?.error?.message || error?.message || 'Unknown error';
    return throwError(() => new Error(message));
  }
}