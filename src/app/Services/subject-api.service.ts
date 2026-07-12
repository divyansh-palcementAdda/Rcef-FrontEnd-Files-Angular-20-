import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../environment/environment';
import {
  SubjectDto,
  SubjectRequest,
  SubjectAnalytics,
  SubjectDetail,
  AssignedUserMin
} from '../Model/subject';

@Injectable({
  providedIn: 'root'
})
export class SubjectApiService {
  private apiUrl = `${environment.apiUrl}/subjects`;

  constructor(private http: HttpClient) {}

  // ---- CRUD ----

  getAllSubjects(): Observable<SubjectDto[]> {
    return this.http.get<SubjectDto[]>(this.apiUrl).pipe(
      catchError(err => this.handleError(err, 'fetch all subjects'))
    );
  }

  getSubjectById(id: number): Observable<SubjectDto> {
    return this.http.get<SubjectDto>(`${this.apiUrl}/${id}`).pipe(
      catchError(err => this.handleError(err, 'fetch subject by id'))
    );
  }

  getSubjectDetail(id: number): Observable<SubjectDetail> {
    return this.http.get<SubjectDetail>(`${this.apiUrl}/${id}/detail`).pipe(
      catchError(err => this.handleError(err, 'fetch subject detail'))
    );
  }

  getSubjectsByDepartment(deptId: number): Observable<SubjectDto[]> {
    return this.http.get<SubjectDto[]>(`${this.apiUrl}/department/${deptId}`).pipe(
      catchError(err => this.handleError(err, 'fetch subjects by department'))
    );
  }

  getSubjectsBySubDepartment(subDeptId: string): Observable<SubjectDto[]> {
    return this.http.get<SubjectDto[]>(`${this.apiUrl}/sub-department/${subDeptId}`).pipe(
      catchError(err => this.handleError(err, 'fetch subjects by sub-department'))
    );
  }

  getSubjectsByUser(userId: number): Observable<SubjectDto[]> {
    return this.http.get<SubjectDto[]>(`${this.apiUrl}/user/${userId}`).pipe(
      catchError(err => this.handleError(err, 'fetch subjects by user'))
    );
  }

  createSubject(payload: SubjectRequest): Observable<SubjectDto> {
    return this.http.post<SubjectDto>(this.apiUrl, payload).pipe(
      catchError(err => this.handleError(err, 'create subject'))
    );
  }

  updateSubject(id: number, payload: SubjectRequest): Observable<SubjectDto> {
    return this.http.put<SubjectDto>(`${this.apiUrl}/${id}`, payload).pipe(
      catchError(err => this.handleError(err, 'update subject'))
    );
  }

  deleteSubject(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      catchError(err => this.handleError(err, 'delete subject'))
    );
  }

  activateSubject(id: number): Observable<SubjectDto> {
    return this.http.put<SubjectDto>(`${this.apiUrl}/${id}/activate`, {}).pipe(
      catchError(err => this.handleError(err, 'activate subject'))
    );
  }

  // ---- Analytics ----

  getSubjectAnalytics(id: number): Observable<SubjectAnalytics> {
    return this.http.get<SubjectAnalytics>(`${this.apiUrl}/${id}/analytics`).pipe(
      catchError(err => this.handleError(err, 'fetch subject analytics'))
    );
  }

  // ---- User assignment ----

  getUsersForSubject(id: number): Observable<AssignedUserMin[]> {
    return this.http.get<AssignedUserMin[]>(`${this.apiUrl}/${id}/users`).pipe(
      catchError(err => this.handleError(err, 'fetch users for subject'))
    );
  }

  assignUsers(subjectId: number, userIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/${subjectId}/users/assign`, { ids: userIds }).pipe(
      catchError(err => this.handleError(err, 'assign users to subject'))
    );
  }

  removeUsers(subjectId: number, userIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/${subjectId}/users/remove`, { ids: userIds }).pipe(
      catchError(err => this.handleError(err, 'remove users from subject'))
    );
  }

  getSubjects(departmentId?: number | null, subDepartmentId?: string | null): Observable<SubjectDto[]> {
    let params: any = {};
    if (departmentId != null) {
      params.departmentId = departmentId.toString();
    }
    if (subDepartmentId != null) {
      params.subDepartmentId = subDepartmentId;
    }
    return this.http.get<SubjectDto[]>(this.apiUrl, { params }).pipe(
      catchError(err => this.handleError(err, 'fetch filtered subjects'))
    );
  }

  // ---- Shared error handler ----

  private handleError(error: any, context: string) {
    console.error(`[SubjectApiService] Error in ${context}:`, error);
    const message = error?.error?.message || error?.message || 'Unknown error';
    return throwError(() => new Error(message));
  }
}
