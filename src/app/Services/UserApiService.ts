import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { Observable } from 'rxjs';
import { userDto } from '../Model/userDto';
@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private apiUrl = `${environment.apiUrl}`;
  constructor(private http: HttpClient) { }

   getAllUsers(): Observable<userDto[]> {
    console.log('Fetching users from:', `${this.apiUrl}/user`);
    return this.http.get<userDto[]>(`${this.apiUrl}/user`);
  }

  createUser(payload: any) {
    console.log('Creating user with payload:', payload);
    return this.http.post(`${this.apiUrl}/auth/register`, payload);
  }
  getAllUsersByStatus(status: string): Observable<userDto[]> {
    console.log('Fetching users with status:', status, 'from:', `${this.apiUrl}/users/status/${status}`);
    return this.http.get<userDto[]>(`${this.apiUrl}/user/status/${status}`);
  }

  deleteUser(userId: number) {
    console.log('Deleting user with ID:', userId);
    return this.http.delete(`${this.apiUrl}/user/${userId}`);
  }
  getAllUsersByDepartment(departmentId: number): Observable<userDto[]> {
    return this.http.get<userDto[]>(`${this.apiUrl}/users/department/${departmentId}`);
  }
    getUserById(userId: number): Observable<userDto> {  
    console.log('Fetching user with ID:', userId, 'from:', `${this.apiUrl}/user/${userId}`);
    return this.http.get<userDto>(`${this.apiUrl}/user/${userId}`);
  }
  toggleUserStatus(userId: number) {
  return this.http.put<{ success: boolean; message: string }>(
    `${this.apiUrl}/user/${userId}/toggle-status`, {},
  );
}

}