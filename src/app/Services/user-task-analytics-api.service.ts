import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environment/environment';

export interface UserTaskDepartmentCardDTO {
  /**
   * "DEPARTMENT" for SUPER_ADMIN/ADMIN/SUB_ADMIN,
   * "SUB_DEPARTMENT" for HOD/TEACHER.
   */
  cardType: 'DEPARTMENT' | 'SUB_DEPARTMENT';

  // Department mode fields
  departmentId?: number;
  departmentName?: string;

  // Sub-department mode fields (UUID as string from backend)
  subDepartmentId?: string;
  subDepartmentName?: string;

  // Shared stats
  totalUsers: number;
  totalActiveTasks: number;
  taskCompletionPercentage: number;
}

export interface UserTaskRequestDetailDTO {
  requestId: number;
  taskId: number;
  taskTitle: string;
  requestType: string;
  status: string;
  requestedOn: string;
  actionTakenOn: string;
  reviewedBy: string;
  reason: string;
  rejectionReason: string;
  cancellationReason: string;
  approvalRemark: string;
}

export interface UserTaskAnalyticsRowDTO {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  employeeId: string;
  role: string;
  departmentName: string;
  subDepartmentName: string;
  totalTasks: number;
  completed: number;
  pending: number;
  inProgress: number;
  upcoming: number;
  delayed: number;
  closed: number;
  requestForClosure: number;
  requestForExtension: number;
  extended: number;
  recurringTasks: number;
  completionPercentage: number;
  totalRequests: number;
  extensionPending: number;
  extensionApproved: number;
  extensionRejected: number;
  closurePending: number;
  closureApproved: number;
  closureRejected: number;
  requests: UserTaskRequestDetailDTO[];
}

export interface UserTaskAnalyticsDetailDTO {
  summary: UserTaskAnalyticsRowDTO;
  requestDetails: UserTaskRequestDetailDTO[];
}

export interface TaskSummaryDTO {
  taskId: number;
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  status: string;
  createdByName: string;
  assignedToName: string;
  assignedToNames: string[];
  subjectName: string;
  templateTitle: string;
  targetCount: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserTaskAnalyticsApiService {
  private apiUrl = `${environment.apiUrl}/user-task-analytics`;

  constructor(private http: HttpClient) {}

  getDepartmentCards(startDate?: string, endDate?: string): Observable<UserTaskDepartmentCardDTO[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<UserTaskDepartmentCardDTO[]>(`${this.apiUrl}/departments`, { params });
  }

  getUserTaskAnalytics(
    departmentId?: number | null,
    subDepartmentId?: string,
    roleName?: string,
    userId?: number | null,
    taskStatus?: string,
    taskPriority?: string,
    startDate?: string,
    endDate?: string,
    isRecurring?: boolean | null,
    activeUsersOnly: boolean = true,
    search: string = '',
    page: number = 0,
    size: number = 10,
    sort: string = 'fullName,asc'
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (departmentId !== null && departmentId !== undefined && departmentId !== 0) {
      params = params.set('departmentId', departmentId.toString());
    }
    if (subDepartmentId && subDepartmentId.trim() !== '') {
      params = params.set('subDepartmentId', subDepartmentId);
    }
    if (roleName && roleName.trim() !== '') {
      params = params.set('roleName', roleName);
    }
    if (userId !== null && userId !== undefined && userId !== 0) {
      params = params.set('userId', userId.toString());
    }
    if (taskStatus && taskStatus !== 'ALL') {
      params = params.set('taskStatus', taskStatus);
    }
    if (taskPriority && taskPriority !== 'ALL') {
      params = params.set('taskPriority', taskPriority);
    }
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    if (isRecurring !== null && isRecurring !== undefined) {
      params = params.set('isRecurring', isRecurring.toString());
    }
    if (activeUsersOnly !== undefined) {
      params = params.set('activeUsersOnly', activeUsersOnly.toString());
    }
    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    return this.http.get<any>(`${this.apiUrl}`, { params });
  }

  getUserTaskAnalyticsDetail(userId: number): Observable<UserTaskAnalyticsDetailDTO> {
    return this.http.get<UserTaskAnalyticsDetailDTO>(`${this.apiUrl}/${userId}`);
  }

  getUserTasksDrillDown(
    userId: number,
    status?: string,
    isRecurring?: boolean | null,
    search: string = '',
    page: number = 0,
    size: number = 10,
    sort: string = 'createdAt,desc'
  ): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    if (status && status !== 'ALL') params = params.set('status', status);
    if (isRecurring !== null && isRecurring !== undefined) params = params.set('isRecurring', isRecurring.toString());
    if (search && search.trim() !== '') params = params.set('search', search.trim());

    return this.http.get<any>(`${this.apiUrl}/${userId}/tasks`, { params });
  }

  getUserRequests(userId: number): Observable<UserTaskRequestDetailDTO[]> {
    return this.http.get<UserTaskRequestDetailDTO[]>(`${this.apiUrl}/${userId}/requests`);
  }

  getExportUrl(
    departmentId?: number | null,
    subDepartmentId?: string,
    roleName?: string,
    userId?: number | null,
    taskStatus?: string,
    taskPriority?: string,
    startDate?: string,
    endDate?: string,
    isRecurring?: boolean | null,
    activeUsersOnly: boolean = true,
    search: string = '',
    format: string = 'EXCEL'
  ): string {
    let url = `${this.apiUrl}/export?format=${format}&activeUsersOnly=${activeUsersOnly}`;
    if (departmentId) url += `&departmentId=${departmentId}`;
    if (subDepartmentId) url += `&subDepartmentId=${encodeURIComponent(subDepartmentId)}`;
    if (roleName) url += `&roleName=${encodeURIComponent(roleName)}`;
    if (userId) url += `&userId=${userId}`;
    if (taskStatus && taskStatus !== 'ALL') url += `&taskStatus=${encodeURIComponent(taskStatus)}`;
    if (taskPriority && taskPriority !== 'ALL') url += `&taskPriority=${encodeURIComponent(taskPriority)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    if (isRecurring !== null && isRecurring !== undefined) url += `&isRecurring=${isRecurring}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return url;
  }
}
