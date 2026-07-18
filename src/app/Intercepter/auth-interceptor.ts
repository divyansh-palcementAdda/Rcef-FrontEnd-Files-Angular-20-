// src/app/interceptors/auth.interceptor.ts
import { Injectable, Injector } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, finalize } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthApiService } from '../Services/auth-api-service';
import { HttpContextToken } from '@angular/common/http';
import { AccessDeniedModalService } from '../Services/access-denied-modal.service';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh-token',
  // '/api/auth/register',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private injector: Injector,
    private snackBar: MatSnackBar
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = new URL(req.url).pathname;
    const isPublic = PUBLIC_PATHS.some(p => url.endsWith(p)) || req.context.get(SKIP_AUTH);

    if (isPublic) {
      return next.handle(req);
    }

    const authService = this.injector.get(AuthApiService);
    const accessToken = authService.getAccessToken();
    const authReq = accessToken
      ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isPublic) {
          return this.handle401Error(authReq, next);
        }
        if (error.status === 403) {
          const accessDeniedModal = this.injector.get(AccessDeniedModalService);
          accessDeniedModal.show();
          return throwError(() => error);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (this.isRefreshing) {
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token =>
          next.handle(
            request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          )
        )
      );
    }

    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    const authService = this.injector.get(AuthApiService);
    const refreshToken = authService.getRefreshToken();
    if (!refreshToken) {
      this.logoutAndRedirect();
      return throwError(() => new Error('No refresh token'));
    }

    return authService.refreshToken(refreshToken).pipe(
      switchMap((response: any) => {
        const newToken = response.accessToken;
        authService.setAccessToken(newToken);
        this.refreshTokenSubject.next(newToken);
        return next.handle(
          request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
        );
      }),
      catchError(err => {
        this.logoutAndRedirect();
        return throwError(() => err);
      }),
      finalize(() => {
        this.isRefreshing = false;
      })
    );
  }

  private logoutAndRedirect(): void {
    // Clear auth locally and redirect — no API call needed here since refresh already failed
    const authService = this.injector.get(AuthApiService);
    authService.clearAuthAndRedirect();
    this.snackBar.open('Session expired. Please log in again.', 'OK', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}