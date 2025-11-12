// src/app/interceptors/auth.interceptor.ts
import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthApiService } from '../Services/auth-api-service';
import { MatSnackBar } from '@angular/material/snack-bar';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/refresh-token',
];

const getPath = (url: string): string => new URL(url, 'http://localhost').pathname;

const logoutAndRedirect = (auth: AuthApiService, snack: MatSnackBar) => {
  auth.logout();
  snack.open('Session expired. Please log in again.', 'OK', {
    duration: 5000,
    horizontalPosition: 'center',
    verticalPosition: 'top',
  });
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthApiService);
  const snackBar = inject(MatSnackBar);

  const path = getPath(req.url);
  const isPublic = PUBLIC_PATHS.some(p => path.endsWith(p));
  if (isPublic) return next(req);

  const token = authService.getAccessToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublic) {
        return handle401Error(req, next, authService, snackBar);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(
  request: HttpRequest<any>,
  next: HttpHandlerFn,
  auth: AuthApiService,
  snack: MatSnackBar
): Observable<HttpEvent<any>> {
  if (isRefreshing) {
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })))
    );
  }

  isRefreshing = true;
  refreshTokenSubject.next(null);

  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) {
    logoutAndRedirect(auth, snack);
    return throwError(() => new Error('No refresh token'));
  }

  return auth.refreshToken(refreshToken).pipe(
    switchMap((response) => {
      const newToken = response.accessToken;
      localStorage.setItem('accessToken', newToken);
      if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken);

      refreshTokenSubject.next(newToken);
      return next(request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
    }),
    catchError((err) => {
      logoutAndRedirect(auth, snack);
      return throwError(() => err);
    }),
    // Use finally() or tap with reset
    // finalize(() => { isRefreshing = false; })
    // Instead, use tap to ensure it runs
    switchMap((res) => {
      isRefreshing = false;
      return [res];
    }),
    catchError((err) => {
      isRefreshing = false;
      return throwError(() => err);
    })
  );
}