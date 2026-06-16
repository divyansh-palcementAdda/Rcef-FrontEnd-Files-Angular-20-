import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private readonly baseUrl = `${environment.apiUrl}/students/reporting/students`;

  constructor(private http: HttpClient) {}

  getStudents(search?: string, page: number = 0, size: number = 20, course?: string): Observable<StudentReportingResponse> {
    let url = `${this.baseUrl}?page=${page}&size=${size}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (course) {
      url += `&course=${encodeURIComponent(course)}`;
    }
    return this.http.get<StudentReportingResponse>(url, {
      context: new HttpContext().set(SKIP_AUTH, true),
      headers: { 'X-API-KEY': 'Q0NwV0lJc2tVQk1jVjR6R2hSYjV4TjNwWmV2M2hJQW5Kc1RjM0F5Z0RrR1Q=' }
    });
  }
}
