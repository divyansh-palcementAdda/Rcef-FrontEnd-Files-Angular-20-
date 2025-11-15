// src/app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
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

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh-token',
  '/api/auth/register',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthApiService,
    private snackBar: MatSnackBar
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = new URL(req.url).pathname;
    const isPublic = PUBLIC_PATHS.some(p => url.endsWith(p));

    if (isPublic) {
      return next.handle(req);
    }

    const accessToken = this.authService.getAccessToken();
    const authReq = accessToken
      ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isPublic) {
          return this.handle401Error(authReq, next);
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

    const refreshToken = this.authService.getRefreshToken();
    if (!refreshToken) {
      this.logoutAndRedirect();
      return throwError(() => new Error('No refresh token'));
    }

    return this.authService.refreshToken(refreshToken).pipe(
      switchMap((response: any) => {
        const newToken = response.accessToken;
        this.authService.setAccessToken(newToken);
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
    this.authService.logout();
    this.snackBar.open('Session expired. Please log in again.', 'OK', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}