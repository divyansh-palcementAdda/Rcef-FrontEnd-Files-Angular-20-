import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLog } from '../Model/audit-log';
import { environment } from '../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class AuditLogApiService {

  private apiUrl = `${environment.apiUrl}/audit-logs`; // Adjust if endpoint differs

  constructor(private http: HttpClient) { }

  /**
   * Get audit logs for a specific user by userId
   * Expected backend endpoint: GET /audit-logs/user/{userId}
   */
  getLogsByUser(userId: number): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/user/${userId}`);
  }

  /**
   * Optional: Get all logs (admin only)
   */
  getAllLogs(page: number = 0, size: number = 20): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'timestamp,desc');

    return this.http.get<any>(this.apiUrl, { params });
  }

  /**
   * Optional: Get logs by entity (e.g., all actions on a Task)
   */
  getLogsByEntity(entity: string, entityId: number): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/entity/${entity}/${entityId}`);
  }
}