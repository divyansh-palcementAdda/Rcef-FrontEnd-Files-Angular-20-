import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { Department } from '../Model/department';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn :'root'
})
export class DepartmentApiService {
  private apiUrl = `${environment.apiUrl}/departments`; // <-- fixed base path

  constructor(private http: HttpClient) {}

  // ---------------- Department APIs ----------------
  getAllDepartments(): Observable<Department[]> {
    console.log('Fetching departments from:', this.apiUrl);
    return this.http.get<Department[]>(this.apiUrl).pipe(
      catchError(err => this.handleError(err, 'fetch all departments'))
    );
  }

  createDepartment(payload: Department): Observable<any> {
    console.log('Creating department with payload:', payload);
    return this.http.post(this.apiUrl, payload).pipe(
      catchError(err => this.handleError(err, 'create department'))
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
    return this.http.post<Department[]>(`${this.apiUrl}/by-ids`, { ids }).pipe(
      catchError(err => this.handleError(err, 'fetch departments by IDs'))
    );
  }
getDepartmentById(id: number): Observable<Department> {
    return this.http.get<Department>(`${this.apiUrl}/${id}`);
  }
  // -------------------------------------------------
  private handleError(error: any, context: string) {
    console.error(`Error in ${context}:`, error);
    const message = error?.error?.message || error?.message || 'Unknown error';
    return throwError(() => new Error(message));
  }
}