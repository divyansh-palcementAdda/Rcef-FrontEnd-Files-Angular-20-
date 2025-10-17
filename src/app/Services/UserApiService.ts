import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { userDto } from '../Model/userDto';

@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) { }

  getAllUsers(): Observable<userDto[]> {
    console.log('Fetching all users from:', `${this.apiUrl}/user`);
    return this.http.get<userDto[]>(`${this.apiUrl}/user`);
  }

  createUser(payload: any) {
    console.log('Creating user with payload:', payload);
    return this.http.post(`${this.apiUrl}/auth/register`, payload);
  }

  getAllUsersByStatus(status: string): Observable<userDto[]> {
    console.log('Fetching users with status:', status);
    return this.http.get<userDto[]>(`${this.apiUrl}/user/status/${status}`);
  }

  getAllUsersByDepartment(departmentId: number): Observable<userDto[]> {
    console.log('Fetching users for department ID:', departmentId);
    return this.http.get<userDto[]>(`${this.apiUrl}/user/department/${departmentId}`);
  }

  getUserById(userId: number): Observable<userDto> {
    console.log('Fetching user with ID:', userId);
    return this.http.get<userDto>(`${this.apiUrl}/user/${userId}`);
  }

  deleteUser(userId: number) {
    console.log('Deleting user with ID:', userId);
    return this.http.delete(`${this.apiUrl}/user/${userId}`);
  }

  toggleUserStatus(userId: number) {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/user/${userId}/toggle-status`,
      {}
    );
  }

  /**
   * Fetch users for multiple departments
   * Returns a single array of users, deduplicated by userId
   */
  getUsersByDepartments(deptIds: number[]): Observable<userDto[]> {
    if (!deptIds || deptIds.length === 0) {
      return of([]); // return empty array if no department IDs
    }

    const requests = deptIds.map(id =>
      this.getAllUsersByDepartment(id).pipe(
        catchError(err => {
          console.error(`Failed to load users for department ${id}`, err);
          return of([]); // continue even if one request fails
        })
      )
    );

    return forkJoin(requests).pipe(
      map(results => {
        // Flatten array of arrays and remove duplicates by userId
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
}
