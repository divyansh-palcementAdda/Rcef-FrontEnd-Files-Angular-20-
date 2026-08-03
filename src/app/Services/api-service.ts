import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardDto } from '../Model/DashboardDto';
import { Department } from '../Model/department';
import { environment } from '../environment/environment';


export interface MonthlyTrend {
  month: string;           // e.g. "Jan 2025", "January", "2025-01"
  taskCompletion: number;
  userActivity: number;
  // Optional extra fields you might add later
  newUsers?: number;
  activeSessions?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  
  private apiUrl = `${environment.apiUrl}`;


  constructor(private http: HttpClient) { }
 

  /**
   * Fetches monthly trends data for the activity line chart
   * @param year Optional - defaults to current year
   * @returns Observable of array of monthly stats
   */
  getMonthlyTrends(year?: number): Observable<MonthlyTrend[]> {
    const currentYear = new Date().getFullYear();
    const requestedYear = year || currentYear;

    return this.http.get<MonthlyTrend[]>(
      `${this.apiUrl}/dashboard/monthly-trends`,
      {
        params: { year: requestedYear.toString() }
      }
    );
  }
  // ---------------- Dashboard ----------------
  getDashboardData(): Observable<DashboardDto> {
    // console.log('Fetching dashboard data from:', `${this.apiUrl}/dashboard`);
    return this.http.get<DashboardDto>(`${this.apiUrl}/dashboard`);
  }

  // ---------------- OTP APIs ----------------
  sendOtp(payload: { email: string }): Observable<{ message: string }> {
    // console.log('Sending OTP to email:', payload.email);
    return this.http.post<{ message: string }>(`${this.apiUrl}/otp/send-otp`, payload);
  }

  validateOtp(payload: { email: string; otp: string }): Observable<{ success: boolean; message: string }> {
    // console.log('Validating OTP:', payload.otp, 'for email:', payload.email);
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/otp/verify-otp`, payload);
  }

  // ---------------- Tasks Search API ----------------
  searchTasks(params: {
    departmentId: number;
    page: number;
    size: number;
    sortBy: string;
    sortDirection: string;
  }): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/tasks/search`, { params });
  }

  // ---------------- User Search API ----------------
  searchUsers(params: {
    page: number;
    size: number;
    sortBy: string;
    sortDirection: string;
    role?: string;
    departmentId?: number;
  }): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/user/search`, { params });
  }

  // ---------------- Task Requests Search API ----------------
  searchTaskRequests(params: {
    page: number;
    size: number;
    sortBy: string;
    sortDirection: string;
    status?: string;
  }): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/task-requests/search`, { params });
  }

  // ---------------- Sub-Departments API ----------------
  getSubDepartments(params?: {
    page?: number;
    size?: number;
    sortBy?: string;
    sortDirection?: string;
  }): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/sub-departments`, { params });
  }

}
