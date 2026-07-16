import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { Observable, forkJoin, of, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
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
  private readonly currentUser$ = new BehaviorSubject<userDto | null>(null);
  readonly currentUserProfile$ = this.currentUser$.asObservable();

  private profileRequest$: Observable<userDto> | null = null;

  constructor(private http: HttpClient) { }

  getCurrentUserProfile(userId: number): Observable<userDto> {
    const cached = this.currentUser$.value;
    if (cached && cached.userId === userId) {
      return of(cached);
    }
    if (this.profileRequest$) {
      return this.profileRequest$;
    }

    this.profileRequest$ = this.getUserById(userId).pipe(
      tap(user => {
        this.currentUser$.next(user);
        this.profileRequest$ = null;
      }),
      catchError(err => {
        this.profileRequest$ = null;
        return throwError(() => err);
      }),
      shareReplay(1)
    );
    return this.profileRequest$;
  }

  clearCurrentUserProfile(): void {
    this.currentUser$.next(null);
  }

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

  getAllUsersBySubDepartment(subDeptId: string): Observable<userDto[]> {
    console.log('Fetching users for sub-department ID:', subDeptId);
    return this.http.get<userDto[]>(`${this.apiUrl}/sub-department/${subDeptId}`).pipe(
      catchError(err => this.handleError(err, 'fetch users by sub-department'))
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
   * Fetch users for multiple sub-departments
   * Returns deduplicated array
   */
  getUsersBySubDepartments(subDeptIds: string[]): Observable<userDto[]> {
    if (!subDeptIds || subDeptIds.length === 0) {
      return of([]);
    }

    const requests = subDeptIds.map(id =>
      this.getAllUsersBySubDepartment(id).pipe(
        catchError(err => {
          console.error(`Failed to load users for sub-department ${id}`, err);
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

  getDepartmentAdmins(departmentId: number): Observable<userDto[]> {
    return this.http.get<userDto[]>(`${this.apiUrl}/department/${departmentId}/admins`).pipe(
      catchError(err => this.handleError(err, 'fetch department admins'))
    );
  }

  getSubDepartmentHods(subDepartmentId: string): Observable<userDto[]> {
    return this.http.get<userDto[]>(`${this.apiUrl}/sub-department/${subDepartmentId}/hods`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department HODs'))
    );
  }

  getEligibleUsers(departmentId?: number, subDepartmentId?: string, subjectId?: number): Observable<userDto[]> {
    let params: any = {};
    if (departmentId) params.departmentId = departmentId.toString();
    if (subDepartmentId) params.subDepartmentId = subDepartmentId;
    if (subjectId) params.subjectId = subjectId.toString();

    return this.http.get<userDto[]>(`${this.apiUrl}/eligible`, { params }).pipe(
      catchError(err => this.handleError(err, 'fetch eligible users'))
    );
  }

  getReportingManagers(userId: number): Observable<userDto[]> {
    return this.http.get<userDto[]>(`${this.apiUrl}/${userId}/reporting-managers`).pipe(
      catchError(err => this.handleError(err, 'fetch reporting managers'))
    );
  }

  getReportees(userId: number): Observable<userDto[]> {
    return this.http.get<userDto[]>(`${this.apiUrl}/${userId}/reportees`).pipe(
      catchError(err => this.handleError(err, 'fetch reportees'))
    );
  }

  updateReportingManagers(userId: number, managerIds: number[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/${userId}/reporting-managers`, managerIds).pipe(
      catchError(err => this.handleError(err, 'update reporting managers'))
    );
  }

  getEligibleManagers(role: string): Observable<userDto[]> {
    return this.http.get<userDto[]>(`${this.apiUrl}/eligible-managers`, { params: { role } }).pipe(
      catchError(err => this.handleError(err, 'fetch eligible managers'))
    );
  }

  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/users/import/template`, {
      responseType: 'blob'
    }).pipe(
      catchError(err => this.handleError(err, 'download import template'))
    );
  }

  importUsers(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${environment.apiUrl}/users/import`, formData).pipe(
      catchError(err => this.handleError(err, 'import users'))
    );
  }

  downloadImportErrorReport(jobId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/users/import/errors/${jobId}`, {
      responseType: 'blob'
    }).pipe(
      catchError(err => this.handleError(err, 'download import error report'))
    );
  }

  // -------------------------------------------------
  private handleError(error: any, context: string) {
    console.error(`Error in ${context}:`, error);
    const message = error?.error?.message || error?.message || 'Unknown error';
    return throwError(() => new Error(message));
  }
}