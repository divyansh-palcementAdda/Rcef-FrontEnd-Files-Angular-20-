// src/app/services/auth-api.service.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, throwError, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../environment/environment';
import { JWTResponseDTO } from '../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../Model/login-request-dto';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}`;

  private readonly loggedIn = new BehaviorSubject<boolean>(false);
  readonly isLoggedIn$ = this.loggedIn.asObservable();

  private readonly username = new BehaviorSubject<string>('User');
  readonly getUsername$ = this.username.asObservable();

  constructor() {
    const token = this.getAccessToken();
    this.loggedIn.next(!!token);
    if (token) this.updateUserFromToken(token);
  }

  login(loginRequest: LoginRequestDTO): Observable<JWTResponseDTO> {
    return this.http.post<JWTResponseDTO>(`${this.apiUrl}/auth/login`, loginRequest).pipe(
      tap(response => this.handleAuthenticationSuccess(response)),
      catchError((error: HttpErrorResponse) => {
        let errorMsg = 'Login failed. Please try again.';
        const message = error.error?.message || '';

        if (message.includes('not verified')) errorMsg = 'Email not verified.';
        else if (message.includes('inactive')) errorMsg = 'Account is inactive.';
        else if (message.includes('Invalid credentials or user not found')) errorMsg = 'Invalid email or username.';
        else if (message.includes('Invalid credentials')) errorMsg = 'Incorrect password.';

        return throwError(() => new Error(errorMsg));
      })
    );
  }

  refreshToken(refreshToken: string): Observable<JWTResponseDTO> {
    return this.http.post<JWTResponseDTO>(`${this.apiUrl}/auth/refresh-token`, { refreshToken }).pipe(
      tap(response => this.handleAuthenticationSuccess(response)),
      catchError((error: HttpErrorResponse) => {
        this.logout(); // Critical: clear everything on refresh fail
        return throwError(() => new Error('Session expired. Please log in again.'));
      })
    );
  }

  private handleAuthenticationSuccess(response: JWTResponseDTO): void {
    localStorage.setItem('accessToken', response.accessToken);
    if (response.refreshToken) {
      localStorage.setItem('refreshToken', response.refreshToken);
    }
    this.loggedIn.next(true);
    this.updateUserFromToken(response.accessToken);
  }

  private updateUserFromToken(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.username.next(payload.username || payload.sub || 'User');
    } catch (e) {
      this.username.next('User');
    }
  }

  // FULL LOGOUT – CLEAR EVERYTHING
  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken'); // UNCOMMENTED!
    localStorage.removeItem('user');
    localStorage.removeItem('rememberedEmail');
    this.loggedIn.next(false);
    this.username.next('User');
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  goToDashboard(): void {
    const token = this.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload.role;

      if (role === 'ADMIN') this.router.navigate(['/admin']);
      else if (role === 'HOD') this.router.navigate(['/hod']);
      else if (role === 'TEACHER') this.router.navigate(['/teacher']);
      else this.logout();
    } catch (e) {
      this.logout();
    }
  }

  getCurrentRole(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || null;
    } catch {
      return null;
    }
  }
}