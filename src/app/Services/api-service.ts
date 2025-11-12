import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardDto } from '../Model/DashboardDto';
import { Department } from '../Model/department';
import { environment } from '../environment/environment';


@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = `${environment.apiUrl}`;


  constructor(private http: HttpClient) { }
 
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

}
