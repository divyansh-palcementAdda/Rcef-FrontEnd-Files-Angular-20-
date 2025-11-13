import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, finalize } from 'rxjs/operators';
import { AuthApiService } from '../Services/auth-api-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '../Services/notification-service';

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/refresh-token'
];

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthApiService,
    private snackBar: MatSnackBar,
    private notificationService: NotificationService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const path = new URL(req.url, 'http://localhost').pathname;
    const isPublic = PUBLIC_PATHS.some(p => path.endsWith(p));

    console.log('%c[INTERCEPTOR] → HTTP Request Started:', 'color:#4CAF50;font-weight:bold;', req.url);

    if (isPublic) {
      console.log('%c[INTERCEPTOR] → PUBLIC API, Skipping Token:', 'color:#03A9F4;font-weight:bold;', path);
      return next.handle(req);
    }

    const accessToken = this.authService.getAccessToken();
    console.log('[INTERCEPTOR] Current Access Token:', accessToken);

    const authReq = accessToken
      ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : req;

    console.log('%c[INTERCEPTOR] → Sending Request with Token', 'color:#8BC34A;font-weight:bold;');

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('%c[INTERCEPTOR] → HTTP ERROR', 'color:red;font-weight:bold;', error);

        if (error.status === 401 && !isPublic) {
          console.warn('%c[INTERCEPTOR] → 401 Detected. Attempt Refresh...', 'color:orange;font-weight:bold;');
          return this.handle401Error(authReq, next);
        }

        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isRefreshing) {
      console.log('%c[INTERCEPTOR] → Refresh already in progress. Queueing request...', 'color:#FF9800;font-weight:bold;');

      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => {
          console.log('%c[INTERCEPTOR] → Received New Token from Queue → Retrying Request', 'color:#00BCD4;font-weight:bold;');
          return next.handle(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
        })
      );
    }

    console.warn('%c[INTERCEPTOR] → Starting Refresh Token Flow...', 'color:#FFC107;font-weight:bold;');
    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

    const refreshToken = this.authService.getRefreshToken();

    console.log('[INTERCEPTOR] Refresh Token:', refreshToken);

    if (!refreshToken) {
      console.error('%c[INTERCEPTOR] → No Refresh Token Found → Logging Out', 'color:red;font-weight:bold;');
      this.logoutAndRedirect();
      return throwError(() => new Error('No refresh token found'));
    }

    return this.authService.refreshToken(refreshToken).pipe(
      switchMap((response: any) => {
        console.log('%c[INTERCEPTOR] → REFRESH SUCCESS', 'color:#4CAF50;font-weight:bold;', response);

        const newAccess = response.accessToken;
        const newRefresh = response.refreshToken;

        console.log('[INTERCEPTOR] New Access Token:', newAccess);
        console.log('[INTERCEPTOR] New Refresh Token:', newRefresh);

        // Store tokens
        this.authService.setAccessToken(newAccess);
        if (newRefresh) this.authService.setRefreshToken(newRefresh);

        console.log('%c[INTERCEPTOR] → Reconnecting WebSocket...', 'color:#009688;font-weight:bold;');
        this.notificationService.reconnect();

        console.log('%c[INTERCEPTOR] → Broadcasting new token to queued requests', 'color:#00BCD4;font-weight:bold;');
        this.refreshTokenSubject.next(newAccess);

        console.log('%c[INTERCEPTOR] → Retrying Original Request with New Token', 'color:#8BC34A;font-weight:bold;');
        return next.handle(
          request.clone({ setHeaders: { Authorization: `Bearer ${newAccess}` } })
        );
      }),
      catchError(err => {
        console.error('%c[INTERCEPTOR] → REFRESH FAILED → Logging Out', 'color:red;font-weight:bold;', err);
        this.logoutAndRedirect();
        return throwError(() => err);
      }),
      finalize(() => {
        console.log('%c[INTERCEPTOR] → Refresh Flow Completed', 'color:#9C27B0;font-weight:bold;');
        this.isRefreshing = false;
      })
    );
  }

  private logoutAndRedirect(): void {
    console.warn('%c[INTERCEPTOR] → LOGOUT triggered', 'color:red;font-weight:bold;');
    this.authService.logout();

    this.snackBar.open('Session expired. Please log in again.', 'OK', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
