import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardDto } from '../Model/DashboardDto';
// import { userDto } from '../Model/userDto';
import { Department } from '../Model/department';
// import { User } from '../Model/userDto';
import { userDto } from '../Model/userDto';



@Injectable({
  providedIn: 'root'
})
export class ApiService {
  deleteUser(userId: number) {
    console.log('Deleting user with ID:', userId);
    return this.http.delete(`${this.apiUrl}/user/${userId}`);
  }
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  getDashboardData(): Observable<DashboardDto> {
    console.log('Fetching dashboard data from:', `${this.apiUrl}/dashboard`);
    return this.http.get<DashboardDto>(`${this.apiUrl}/dashboard`);
  }

  getAllUsers(): Observable<userDto []> {
    console.log('Fetching users from:', `${this.apiUrl}/user`);
    return this.http.get<userDto[]>(`${this.apiUrl}/user`);
  }

  createDepartment(payload: Department) {
    console.log('Creating department with payload:', payload);
  return this.http.post(`${this.apiUrl}/departments`, payload);
}

 getAllDepartments() {  
  console.log('Fetching departments from:', `${this.apiUrl}/departments`);
  return this.http.get<any[]>(`${this.apiUrl}/departments`);
}

createUser(payload: any) {  
  console.log('Creating user with payload:', payload);
  return this.http.post(`${this.apiUrl}/users`, payload);
}

}
