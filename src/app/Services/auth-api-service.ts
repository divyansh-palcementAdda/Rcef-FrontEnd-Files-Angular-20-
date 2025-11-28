// src/app/services/auth-api.service.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  map,
  throwError,
  tap,
  finalize,
  of,
} from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../environment/environment';
import { JWTResponseDTO } from '../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../Model/login-request-dto';


/* --------------------------------------------------------------------- */
/* API RESPONSE WRAPPER (matches Spring Boot ApiResult<T>)               */
/* --------------------------------------------------------------------- */
interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T | null;
  timestamp: string;
}
  interface LogoutRequest {
  refreshToken: string;
}

/* --------------------------------------------------------------------- */
/* SERVICE                                                               */
/* --------------------------------------------------------------------- */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly apiUrl = `${environment.apiUrl}/auth`;

  /* ---------- login state ---------- */
  private readonly loggedIn$ = new BehaviorSubject<boolean>(false);
  readonly isLoggedIn$ = this.loggedIn$.asObservable();

  /* ---------- username ---------- */
  private readonly usernameSubject$ = new BehaviorSubject<string>('User');
  readonly username$ = this.usernameSubject$.asObservable();

  constructor() {
    const token = this.getAccessToken();
    this.loggedIn$.next(!!token);
    if (token) this.updateUserFromToken(token);
  }

  /* ----------------------------------------------------------------- */
  /* TOKEN STORAGE                                                     */
  /* ----------------------------------------------------------------- */
   setAccessToken(token: string): void {
    localStorage.setItem('accessToken', token);
    this.updateUserFromToken(token);
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem('refreshToken', token);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /* ----------------------------------------------------------------- */
  /* LOGIN                                                             */
  /* ----------------------------------------------------------------- */
  login(credentials: LoginRequestDTO): Observable<JWTResponseDTO> {
    return this.http
      .post<ApiResult<JWTResponseDTO>>(`${this.apiUrl}/login`, credentials)
      .pipe(
        map(res => this.unwrapResult(res, 'Login failed')),
        tap(dto => this.handleAuthSuccess(dto)),
        catchError(this.handleHttpError('Login'))
      );
  }

  /* ----------------------------------------------------------------- */
  /* REFRESH TOKEN                                                     */
  /* ----------------------------------------------------------------- */
  refreshToken(refreshToken: string): Observable<JWTResponseDTO> {
    return this.http
      .post<ApiResult<JWTResponseDTO>>(`${this.apiUrl}/refresh-token`, {
        refreshToken,
      })
      .pipe(
        map(res => this.unwrapResult(res, 'Refresh failed')),
        tap(dto => this.handleAuthSuccess(dto)),
        catchError(this.handleHttpError('Refresh token'))
      );
  }

  /* ----------------------------------------------------------------- */
  /* LOGOUT (per device)                                               */
  /* ----------------------------------------------------------------- */
  logout(refreshToken?: string): Observable<void> {
    console.log('Initiating logout process');
    // Validate refreshToken is provided and not blank
    if (!refreshToken || refreshToken.trim() === '') {
      return throwError(() => new Error('refreshToken is required'));
    }
    const body: LogoutRequest = { refreshToken };

    return this.http.post<ApiResult<void>>(`${this.apiUrl}/logout`, body).pipe(
      tap((res) => {
        if (res.success) {
          console.info('LOGOUT SUCCESS | Refresh token revoked');
          this.clearAuth();
        }
      }),
      map(() => void 0),
      catchError((error: HttpErrorResponse) => {
        console.error('Logout failed:', error);
        // Clear auth locally even if server logout fails
        this.clearAuth();
        return throwError(() => new Error(error.error?.message || 'Logout failed'));
      })
    );
  }

  /* ----------------------------------------------------------------- */
  /* GLOBAL LOGOUT (all devices)                                       */
  /* ----------------------------------------------------------------- */
  logoutAll(userId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout-all`, { userId }).pipe(
      tap(() => this.clearAuth()),
      catchError(() => {
        this.clearAuth();
        return throwError(() => new Error('Global logout failed'));
      })
    );
  }

  /* ----------------------------------------------------------------- */
  /* HELPERS                                                           */
  /* ----------------------------------------------------------------- */
  private unwrapResult<T>(res: ApiResult<T>, operation: string): T {
    if (res.success && res.data) return res.data;
    throw new Error(res.message ?? `${operation} failed`);
  }

  private handleAuthSuccess(dto: JWTResponseDTO): void {
    this.setAccessToken(dto.accessToken);
    if (dto.refreshToken) this.setRefreshToken(dto.refreshToken);
    this.loggedIn$.next(true);
  }

  private clearAuth(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.loggedIn$.next(false);
    this.usernameSubject$.next('User');
    this.router.navigate(['/login']);
  }

  private updateUserFromToken(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const name = payload.username ?? payload.email ?? payload.sub ?? 'User';
      this.usernameSubject$.next(name);
    } catch {
      this.usernameSubject$.next('User');
    }
  }

  private handleHttpError(operation: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      let msg = 'An error occurred. Please try again.';

      if (error.error?.message) {
        msg = error.error.message;
      } else if (error.status === 401) {
        msg = 'Session expired. Please log in again.';
      } else if (error.status === 403) {
        msg = 'Access denied.';
      }

      return throwError(() => new Error(msg));
    };
  }

  /* ----------------------------------------------------------------- */
  /* DASHBOARD & ROLE                                                  */
  /* ----------------------------------------------------------------- */
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
        case 'ADMIN':
          this.router.navigate(['/admin']);
          break;
        case 'HOD':
          this.router.navigate(['/hod']);
          break;
        case 'TEACHER':
          this.router.navigate(['/teacher']);
          break;
        default:
          this.logout();
      }
    } catch {
      this.logout();
    }
  }

  getCurrentRole(): string | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1])).role ?? null;
    } catch {
      return null;
    }
  }
}