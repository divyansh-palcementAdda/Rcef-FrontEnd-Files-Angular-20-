// src/app/services/auth-api.service.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, throwError, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../environment/environment';
import { JWTResponseDTO } from '../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../Model/login-request-dto';

@Injectable({ providedIn: 'root' })
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

  // --------------------------------------------------------------------------
  // TOKEN SETTERS (Used by Interceptor + Login flow)
  // --------------------------------------------------------------------------
  setAccessToken(token: string) {
    console.log('%c[AuthApiService] Setting Access Token', 'color:#4CAF50;');
    localStorage.setItem('accessToken', token);
    this.updateUserFromToken(token);
  }

  setRefreshToken(refreshToken: string) {
    console.log('%c[AuthApiService] Setting Refresh Token', 'color:#FFC107;');
    localStorage.setItem('refreshToken', refreshToken);
  }

  // --------------------------------------------------------------------------
  // LOGIN
  // --------------------------------------------------------------------------
  login(loginRequest: LoginRequestDTO): Observable<JWTResponseDTO> {
    return this.http.post<JWTResponseDTO>(`${this.apiUrl}/auth/login`, loginRequest).pipe(
      tap(res => this.handleAuthenticationSuccess(res)),
      catchError((error: HttpErrorResponse) => {
        let errorMsg = 'Login failed. Please try again.';
        const message = error.error?.message || '';

        if (message.includes('not verified')) errorMsg = 'Email not verified.';
        else if (message.includes('inactive')) errorMsg = 'Account is inactive.';
        else if (message.includes('Invalid credentials or user not found'))
          errorMsg = 'Invalid email or username.';
        else if (message.includes('Invalid credentials'))
          errorMsg = 'Incorrect password.';

        return throwError(() => new Error(errorMsg));
      })
    );
  }

  // --------------------------------------------------------------------------
  // REFRESH TOKEN — Interceptor calls this
  // --------------------------------------------------------------------------
  refreshToken(refreshToken: string): Observable<JWTResponseDTO> {
    console.log('%c[AuthApiService] Requesting refresh...', 'color:#03A9F4;font-weight:bold;');

    return this.http.post<JWTResponseDTO>(`${this.apiUrl}/auth/refresh-token`, { refreshToken }).pipe(
      tap(res => this.handleAuthenticationSuccess(res)),
      catchError((error: HttpErrorResponse) => {
        console.error('%c[AuthApiService] Refresh failed', 'color:red;font-weight:bold;', error);
        return throwError(() => new Error('Session expired. Please log in again.'));
      })
    );
  }

  // --------------------------------------------------------------------------
  // COMMON SUCCESS HANDLER FOR LOGIN + REFRESH
  // --------------------------------------------------------------------------
  private handleAuthenticationSuccess(res: JWTResponseDTO): void {
    console.log('%c[AuthApiService] Authentication success', 'color:#8BC34A;font-weight:bold;');

    this.setAccessToken(res.accessToken);

    if (res.refreshToken) {
      this.setRefreshToken(res.refreshToken);
    }

    this.loggedIn.next(true);
  }

  // --------------------------------------------------------------------------
  // USERNAME / CLAIMS LOADER
  // --------------------------------------------------------------------------
  private updateUserFromToken(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const name = payload.username || payload.sub || 'User';

      console.log('%c[AuthApiService] User from token:', 'color:#9C27B0;', name);
      this.username.next(name);

    } catch (e) {
      console.warn('[AuthApiService] Invalid token payload - fallback username');
      this.username.next('User');
    }
  }

  // --------------------------------------------------------------------------
  // LOGOUT
  // --------------------------------------------------------------------------
  logout(): void {
    console.warn('%c[AuthApiService] Logging out...', 'color:red;font-weight:bold;');

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberedEmail');

    this.loggedIn.next(false);
    this.username.next('User');

    this.router.navigate(['/login']);
  }

  // --------------------------------------------------------------------------
  // TOKEN GETTERS
  // --------------------------------------------------------------------------
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  // --------------------------------------------------------------------------
  // DASHBOARD NAVIGATION BASED ON ROLE
  // --------------------------------------------------------------------------
  goToDashboard(): void {
    const token = this.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = payload.role;

      switch (role) {
        case 'ADMIN':   this.router.navigate(['/admin']); break;
        case 'HOD':     this.router.navigate(['/hod']); break;
        case 'TEACHER': this.router.navigate(['/teacher']); break;
        default:        this.logout(); break;
      }
    } catch {
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
