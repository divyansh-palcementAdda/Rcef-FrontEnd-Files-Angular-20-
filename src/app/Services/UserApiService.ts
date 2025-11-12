import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { userDto } from '../Model/userDto';

@Injectable({
  providedIn: 'root'
})
export class UserApiService {

 
  private apiUrl = `${environment.apiUrl}/user`; // <-- correct base

  constructor(private http: HttpClient) {}

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

  // -------------------------------------------------
  private handleError(error: any, context: string) {
    console.error(`Error in ${context}:`, error);
    const message = error?.error?.message || error?.message || 'Unknown error';
    return throwError(() => new Error(message));
  }
}