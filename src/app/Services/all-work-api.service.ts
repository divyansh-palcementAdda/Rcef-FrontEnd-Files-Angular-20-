import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';

export interface WorkDashboardResponse {
  role: string;
  defaultId: string;
  departments: DepartmentCardDTO[];
  canView: boolean;
  canExport: boolean;
  canViewUsers: boolean;
  canViewTasks: boolean;
  canDownload: boolean;
  canOpenAnalytics: boolean;
}

export interface DepartmentCardDTO {
  departmentId: number;
  name: string;
  totalSubDepartments: number;
  totalUsers: number;
  totalTasks: number;
  pending: number;
  completed: number;
  delayed: number;
  inProgress: number;
  requestForClosure: number;
  requestForExtension: number;
  extended: number;
  upcoming: number;
  recurringParent: number;
}

export interface SubDepartmentRowDTO {
  id: string;
  name: string;
  departmentName: string;
  totalUsers: number;
  /** Number of users with zero tasks (some APIs may name this differently) */
  usersWithZeroTask?: number;
  usersWithZeroTasks?: number;
  totalSubjects: number;
  totalAssignedTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  delayed: number;
  upcoming: number;
  extended: number;
  requestForExtension: number;
  requestForClosure: number;
  recurringParent: number;
  completionPercentage: number;
  lastActivity: string;
  createdDate: string;
  updatedDate: string;
}

export interface UserRowDTO {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  departments: string[];
  subDepartments: string[];
  subjects: string[];
  managers: string[];
  totalAssignedTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  delayed: number;
  upcoming: number;
  extended: number;
  requestForExtension: number;
  requestForClosure: number;
  recurringParent: number;
  completionPercentage: number;
  lastActivity: string;
}

export interface WorkAnalyticsResponse {
  users: number;
  tasks: number;
  requests: number;
  subjects: number;
  statusDistribution: { [key: string]: number };
  priorityDistribution: { [key: string]: number };
  recurringDistribution: { [key: string]: number };
  templateVsGeneral: { [key: string]: number };
  workloadDistribution: { fullName: string; totalTasks: number }[];
  completionPercentage: number;
  averageCompletionTime: number;
  delayedPercentage: number;
  upcomingPercentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class AllWorkApiService {
  private apiUrl = `${environment.apiUrl}/work`;

  constructor(private http: HttpClient) {}

  getDashboardData(): Observable<WorkDashboardResponse> {
    return this.http.get<WorkDashboardResponse>(`${this.apiUrl}/dashboard`);
  }

  getDepartments(): Observable<DepartmentCardDTO[]> {
    return this.http.get<DepartmentCardDTO[]>(`${this.apiUrl}/departments`);
  }

  getSubDepartments(
    deptId: number | null,
    search: string = '',
    filters: string = '',
    page: number = 0,
    size: number = 10,
    sort: string = 'name,asc'
  ): Observable<any> {
    let params = new HttpParams()
      .set('search', search)
      .set('filters', filters)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (deptId !== null && deptId !== undefined && deptId !== 0) {
      params = params.set('departmentId', deptId.toString());
    }

    return this.http.get<any>(`${this.apiUrl}/subdepartments`, { params });
  }

  getSubDepartmentUsers(
    subDeptId: string,
    search: string = '',
    page: number = 0,
    size: number = 10,
    sort: string = 'fullName,asc'
  ): Observable<any> {
    let params = new HttpParams()
      .set('search', search)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<any>(`${this.apiUrl}/subdepartments/${subDeptId}/users`, { params });
  }

  getSubDepartmentTasks(
    subDeptId: string,
    search: string = '',
    status: string = 'ALL',
    page: number = 0,
    size: number = 10,
    sort: string = 'createdAt,desc'
  ): Observable<any> {
    let params = new HttpParams()
      .set('search', search)
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<any>(`${this.apiUrl}/subdepartments/${subDeptId}/tasks`, { params });
  }

  getUserTasks(
    userId: number,
    search: string = '',
    status: string = 'ALL',
    page: number = 0,
    size: number = 10,
    sort: string = 'createdAt,desc'
  ): Observable<any> {
    let params = new HttpParams()
      .set('search', search)
      .set('status', status)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.get<any>(`${this.apiUrl}/users/${userId}/tasks`, { params });
  }

  getSubDepartmentAnalytics(subDeptId: string): Observable<WorkAnalyticsResponse> {
    return this.http.get<WorkAnalyticsResponse>(`${this.apiUrl}/subdepartments/${subDeptId}/analytics`);
  }

  getUserAnalytics(userId: number): Observable<WorkAnalyticsResponse> {
    return this.http.get<WorkAnalyticsResponse>(`${this.apiUrl}/users/${userId}/analytics`);
  }

  // Export URL builders
  getExportSubDepartmentsUrl(departmentId: number | null, search: string = '', filters: string = '', format: string = 'EXCEL'): string {
    let url = `${this.apiUrl}/export/subdepartments?search=${encodeURIComponent(search)}&filters=${encodeURIComponent(filters)}&format=${format}`;
    if (departmentId !== null && departmentId !== undefined && departmentId !== 0) {
      url += `&departmentId=${departmentId}`;
    }
    return url;
  }

  exportSubDepartmentsBlob(departmentId: number | null, search: string = '', filters: string = '', format: string = 'EXCEL') {
    const url = this.getExportSubDepartmentsUrl(departmentId, search, filters, format);
    return this.http.get(url, { observe: 'response', responseType: 'blob' as 'json' });
  }

  getExportUsersUrl(subDepartmentId: string, search: string = '', format: string = 'EXCEL'): string {
    return `${this.apiUrl}/export/users?subDepartmentId=${subDepartmentId}&search=${encodeURIComponent(search)}&format=${format}`;
  }

  getExportTasksUrl(subDeptId: string | null, userId: number | null, search: string = '', status: string = 'ALL', format: string = 'EXCEL'): string {
    let url = `${this.apiUrl}/export/tasks?search=${encodeURIComponent(search)}&status=${status}&format=${format}`;
    if (subDeptId) {
      url += `&subDepartmentId=${subDeptId}`;
    }
    if (userId) {
      url += `&userId=${userId}`;
    }
    return url;
  }
}
