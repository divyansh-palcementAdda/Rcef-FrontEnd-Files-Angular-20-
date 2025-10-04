// src/app/Services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, timer } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private dashboardDataSubject = new BehaviorSubject<any>(null);
  dashboardData$ = this.dashboardDataSubject.asObservable();
  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  /** 🔸 Load or refresh dashboard data */
  fetchDashboardData(): void {
    this.http.get<any>(`${this.apiUrl}/dashboard`) // ⬅️ replace with your real API URL
      .pipe(
        tap(data => this.dashboardDataSubject.next(data)),
        catchError(err => {
          console.error('❌ Error loading dashboard data', err);
          return [];
        })
      )
      .subscribe();
  }

  /** 🕒 Optional: Auto-refresh dashboard periodically */
  startAutoRefresh(intervalMs: number = 30000): void {
    timer(0, intervalMs)
      .pipe(
        switchMap(() => this.http.get<any>(`${this.apiUrl}/dashboard`)),
        tap(data => this.dashboardDataSubject.next(data)),
        catchError(err => {
          console.error('❌ Error auto-refreshing dashboard', err);
          return [];
        })
      )
      .subscribe();
  }
}
