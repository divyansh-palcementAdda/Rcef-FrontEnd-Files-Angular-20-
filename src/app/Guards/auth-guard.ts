// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthApiService } from '../Services/auth-api-service';
export const AuthGuard: CanActivateFn = (): boolean | UrlTree => {
  const router   = inject(Router);
  const snack    = inject(MatSnackBar);
  const authSrv  = inject(AuthApiService);

  const accessToken = localStorage.getItem('accessToken');

  // ----------------------------------------------------------------------
  // No token at all → force login
  // ----------------------------------------------------------------------
  if (!accessToken) {
    showExpired(snack);
    authSrv.logout();
    return router.createUrlTree(['/login']);
  }

  // ----------------------------------------------------------------------
  // Token exists but is expired → force logout (interceptor will refresh
  // only on real 401, not on a stale local token)
  // ----------------------------------------------------------------------
  if (isTokenExpired(accessToken)) {
    showExpired(snack);
    authSrv.logout();
    return router.createUrlTree(['/login']);
  }

  // Token is present **and** not expired → allow navigation
  return true;
};

/* --------------------------------------------------------------------- */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;               // seconds → ms
    return Date.now() > exp;
  } catch {
    return true;   // malformed token = treat as expired
  }
}

function showExpired(snack: MatSnackBar) {
  snack.open('Session expired. Please log in again.', 'Close', {
    duration: 4000,
    panelClass: ['snackbar-expired'],
    horizontalPosition: 'right',
    verticalPosition: 'top',
  });
}