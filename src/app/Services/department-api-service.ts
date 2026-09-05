import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { Department } from '../Model/department';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { catchError, map } from 'rxjs/operators';

export interface DeptTemplateTaskSummary {
  templateId?: number;
  templateTitle: string;
  totalTasks?: number;
  count: number;
  statusBreakdown?: Record<string, number>;
}

interface AuthorizedDepartmentDto {
  departmentId: number;
  departmentName: string;
}

@Injectable({
  providedIn: 'root'
})
export class DepartmentApiService {
  private apiUrl = `${environment.apiUrl}/departments`; // <-- fixed base path

  constructor(private http: HttpClient) { }

  // ---------------- Department APIs ----------------
  getAllDepartments(): Observable<Department[]> {
    console.log('Fetching departments from:', this.apiUrl);
    return this.http.get<any[]>(this.apiUrl).pipe(
      map((response: any) => {
        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.result)
              ? response.result
              : [];

        return items.map((item: any) => ({
          ...item,
          departmentId: item.id || item.departmentId,
          departmentStatus: item.status || item.departmentStatus
        }));
      }),
      catchError(err => this.handleError(err, 'fetch all departments'))
    );
  }

  getAuthorizedDepartments(): Observable<Department[]> {
    return this.http.get<any>(`${this.apiUrl}/authorized`).pipe(
      map((response: any) => {
        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.result)
              ? response.result
              : [];

        return items.map((item: any) => ({
          departmentId: item.id || item.departmentId,
          name: item.departmentName || item.name || `Department #${item.id || item.departmentId}`,
          departmentStatus: item.status || item.departmentStatus || 'ACTIVE'
        }));
      }),
      catchError(err => this.handleError(err, 'fetch authorized departments'))
    );
  }

 getZeroDueDepartmentsAsObjects(): Observable<Department[]> {
  return this.http.get<any[]>(`${this.apiUrl}/zero-due`).pipe(
    map((response: any) => {
      const items = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.result)
            ? response.result
            : [];

      return items.map((item: any) => ({
        ...item,
        departmentId: item.id || item.departmentId,
        departmentStatus: item.status || item.departmentStatus
      }));
    }),
    catchError(err => this.handleError(err, 'fetch zero due departments'))
  );
}
  createDepartment(payload: Department): Observable<any> {
    console.log('Creating department with payload:', payload);
    return this.http.post(this.apiUrl, payload).pipe(
      catchError(err => this.handleError(err, 'create department'))
    );
  }

  updateDepartment(id: number, payload: Department): Observable<any> {
    console.log(`Updating department ${id} with payload:`, payload);
    return this.http.put(`${this.apiUrl}/${id}`, payload).pipe(
      catchError(err => this.handleError(err, 'update department'))
    );
  }

  deleteDepartment(departmentId: number): Observable<any> {
    console.log(`Deleting department with id ${departmentId}`);
    return this.http.delete(`${this.apiUrl}/${departmentId}`).pipe(
      catchError(err => this.handleError(err, 'delete department'))
    );
  }

  /** POST: { ids: [1,2,3] } → returns Department[] */
  getDepartmentsByIds(ids: number[]): Observable<Department[]> {
    if (!ids || ids.length === 0) {
      return throwError(() => new Error('No department IDs provided'));
    }
    return this.http.post<any[]>(`${this.apiUrl}/by-ids`, { ids }).pipe(
      map((response: any) => {
        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.result)
              ? response.result
              : [];

        return items.map((item: any) => ({
          ...item,
          departmentId: item.id || item.departmentId,
          departmentStatus: item.status || item.departmentStatus
        }));
      }),
      catchError(err => this.handleError(err, 'fetch departments by IDs'))
    );
  }
  getDepartmentById(id: number): Observable<Department> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map((response: any) => {
        // Map API response to Department interface
        return {
          ...response,
          departmentId: response.id || response.departmentId,
          departmentStatus: response.status || response.departmentStatus
        };
      })
    );
  }

  getDepartmentStatistics(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  /** GET /api/department/{departmentId}/template-task-summary */
  getDepartmentTaskTemplateSummary(departmentId: number): Observable<DeptTemplateTaskSummary[]> {
    return this.http.get<any>(`${this.apiUrl}/${departmentId}/template-task-summary`).pipe(
      map((res: any) => {
        let items: any[] = [];
        if (Array.isArray(res))                      items = res;
        else if (Array.isArray(res?.data))            items = res.data;
        else if (Array.isArray(res?.templateBreakdown)) items = res.templateBreakdown;
        return items.map(i => ({ ...i, count: i.totalTasks ?? i.count ?? 0 }));
      }),
      catchError(err => this.handleError(err, 'fetch department template task summary'))
    );
  }
  // ---------------- SubDepartment APIs ----------------
  getAuthorizedSubDepartments(): Observable<any[]> {
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/authorized`).pipe(
      map((response: any) => {
        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.result)
              ? response.result
              : [];
        return items.map((item: any) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          description: item.description,
          departmentId: item.department?.departmentId || item.departmentId,
          departmentName: item.department?.name || item.departmentName
        }));
      }),
      catchError(err => this.handleError(err, 'fetch authorized sub-departments'))
    );
  }

  getAllSubDepartments(search?: string): Observable<any[]> {
    const url = search?.trim()
      ? `${environment.apiUrl}/sub-departments?search=${encodeURIComponent(search.trim())}`
      : `${environment.apiUrl}/sub-departments`;
    return this.http.get<any[]>(url).pipe(
      catchError(err => this.handleError(err, 'fetch all sub-departments'))
    );
  }

  getSubDepartmentsByDepartment(deptId: number, search?: string): Observable<any> {
    const url = search?.trim()
      ? `${environment.apiUrl}/sub-departments/department/${deptId}?search=${encodeURIComponent(search.trim())}`
      : `${environment.apiUrl}/sub-departments/department/${deptId}`;
    return this.http.get<any>(url).pipe(
      catchError(err => this.handleError(err, 'fetch sub-departments by department'))
    );
  }

  createSubDepartment(payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sub-departments`, payload).pipe(
      catchError(err => this.handleError(err, 'create sub-department'))
    );
  }

  updateSubDepartment(id: string, payload: any): Observable<any> {
    return this.http.put(`${environment.apiUrl}/sub-departments/${id}`, payload).pipe(
      catchError(err => this.handleError(err, 'update sub-department'))
    );
  }

  deleteSubDepartment(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/sub-departments/${id}`).pipe(
      catchError(err => this.handleError(err, 'delete sub-department'))
    );
  }

  getSubDepartmentById(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department by ID'))
    );
  }

  getSubDepartmentAnalytics(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/analytics`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department analytics'))
    );
  }

  getSubDepartmentUsers(id: string, search?: string, page = 0, size = 10): Observable<any> {
    let queryParams = `?page=${page}&size=${size}`;
    if (search) queryParams += `&search=${encodeURIComponent(search)}`;
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/users${queryParams}`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department users'))
    );
  }

  getSubDepartmentUserBreakdowns(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/user-breakdowns`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department user breakdowns'))
    );
  }

  getSubDepartmentSubjects(id: string, search?: string, page = 0, size = 10, sortBy = 'name', sortDir = 'asc'): Observable<any> {
    let queryParams = `?page=${page}&size=${size}&sortBy=${sortBy}&sortDir=${sortDir}`;
    if (search) queryParams += `&search=${encodeURIComponent(search)}`;
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/subjects${queryParams}`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department subjects'))
    );
  }

  getSubDepartmentTemplates(id: string, page = 0, size = 10, sortBy = 'title', sortDir = 'asc'): Observable<any> {
    let queryParams = `?page=${page}&size=${size}&sortBy=${sortBy}&sortDir=${sortDir}`;
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/templates${queryParams}`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department templates'))
    );
  }

  getSubDepartmentActivity(id: string, page = 0, size = 10): Observable<any> {
    let queryParams = `?page=${page}&size=${size}`;
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/activity${queryParams}`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department activity'))
    );
  }

  getSubDepartmentTasks(id: string, params: any): Observable<any> {
    let queryParams = `?page=${params.page || 0}&size=${params.size || 20}`;
    if (params.search) queryParams += `&search=${encodeURIComponent(params.search)}`;
    if (params.status) queryParams += `&status=${encodeURIComponent(params.status)}`;
    if (params.priority) queryParams += `&priority=${encodeURIComponent(params.priority)}`;
    if (params.taskType) queryParams += `&taskType=${encodeURIComponent(params.taskType)}`;
    if (params.sortBy) queryParams += `&sortBy=${encodeURIComponent(params.sortBy)}`;
    if (params.sortDir) queryParams += `&sortDir=${encodeURIComponent(params.sortDir)}`;
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/tasks${queryParams}`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department tasks'))
    );
  }

  getSubDepartmentCharts(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/sub-departments/${id}/charts`).pipe(
      catchError(err => this.handleError(err, 'fetch sub-department charts'))
    );
  }

  assignUserToSubDepartment(subDeptId: string, userId: number): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/sub-departments/${subDeptId}/users/${userId}`, {}).pipe(
      catchError(err => this.handleError(err, 'assign user to sub-department'))
    );
  }

  removeUserFromSubDepartment(subDeptId: string, userId: number): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrl}/sub-departments/${subDeptId}/users/${userId}`).pipe(
      catchError(err => this.handleError(err, 'remove user from sub-department'))
    );
  }

  assignHodToSubDepartment(subDeptId: string, userId: number): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/sub-departments/${subDeptId}/hods/${userId}`, {}).pipe(
      catchError(err => this.handleError(err, 'assign HOD to sub-department'))
    );
  }

  removeHodFromSubDepartment(subDeptId: string, userId: number): Observable<any> {
    return this.http.delete<any>(`${environment.apiUrl}/sub-departments/${subDeptId}/hods/${userId}`).pipe(
      catchError(err => this.handleError(err, 'remove HOD from sub-department'))
    );
  }

  swapHodInSubDepartment(subDeptId: string, oldHodId: number | null, newHodId: number): Observable<any> {
    let queryParams = `?newHodId=${newHodId}`;
    if (oldHodId) {
      queryParams += `&oldHodId=${oldHodId}`;
    }
    return this.http.post<any>(`${environment.apiUrl}/sub-departments/${subDeptId}/hods/swap${queryParams}`, {}).pipe(
      catchError(err => this.handleError(err, 'swap HOD in sub-department'))
    );
  }

  updateUserRoleInSubDepartment(subDeptId: string, userId: number, newRole: string): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/sub-departments/${subDeptId}/users/${userId}/role?newRole=${encodeURIComponent(newRole)}`, {}).pipe(
      catchError(err => this.handleError(err, 'update user role in sub-department'))
    );
  }

  // -------------------------------------------------
  private handleError(error: any, context: string) {
    console.error(`Error in ${context}:`, error);
    const message = error?.error?.message || error?.message || 'Unknown error';
    return throwError(() => new Error(message));
  }
}