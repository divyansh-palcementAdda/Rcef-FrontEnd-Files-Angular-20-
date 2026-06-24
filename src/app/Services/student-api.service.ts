import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../environment/environment';
import { SKIP_AUTH } from '../Intercepter/auth-interceptor';

export interface StudentReportingDto {
  userId: number;
  enrollmentId: string;
  studentName: string;
  course: string;
}

export interface StudentReportingResponse {
  success: boolean;
  message: string;
  data: StudentReportingDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class StudentApiService {
  private readonly baseUrl = `https://cms.areyoureporting.com/api/students/reporting/students`;

  constructor(private http: HttpClient) { }

  getStudents(search?: string, page: number = 0, size: number = 20, course?: string): Observable<StudentReportingResponse> {
    console.log('Student API called');
    let url = `${this.baseUrl}?page=${page}&size=${size}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (course) {
      url += `&course=${encodeURIComponent(course)}`;
    }
    return this.http.get<StudentReportingResponse>(url, {
      context: new HttpContext().set(SKIP_AUTH, true),
      headers: { 'X-API-KEY': environment.integrationApiKey }
    }).pipe(
      tap({
        next: (res) => {
          console.log(`Student API call completed. success=${res.success}`);
        },
        error: (err) => {
          console.log(`Student API call failed. status=${err.status}`);
        }
      })
    );
  }

  getStudentCounts(studentUserIds: number[]): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/student-reports/counts?studentUserIds=${studentUserIds.join(',')}`);
  }

  getStudentReportDetails(studentUserId: number): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/student-reports/student/${studentUserId}`);
  }
}
