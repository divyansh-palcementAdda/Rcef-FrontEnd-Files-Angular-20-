// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthApiService } from '../Services/auth-api-service';

export const AuthGuard: CanActivateFn = (): boolean | UrlTree => {
  const router  = inject(Router);
  const snack   = inject(MatSnackBar);
  const authSrv = inject(AuthApiService);

  const accessToken  = authSrv.getAccessToken();
  const refreshToken = authSrv.getRefreshToken();

  // --------------------------------------------------------------
  // CASE 1: No access token & no refresh token → Unauthorized user
  // --------------------------------------------------------------
  if (!accessToken && !refreshToken) {
    showExpired(snack);
    authSrv.logout();
    return router.createUrlTree(['/login']);
  }

  // --------------------------------------------------------------
  // CASE 2: Access token missing but refresh token exists
  // Interceptor will refresh it → allow navigation
  // --------------------------------------------------------------
  if (!accessToken && refreshToken) {
    console.warn('[AuthGuard] No access token but refresh token exists → Allow. Interceptor will refresh.');
    return true;
  }

  // --------------------------------------------------------------
  // CASE 3: Access token exists even if expired, do NOT block.
  // Interceptor will handle refresh on first API call.
  // --------------------------------------------------------------
  return true;
};


/* --------------------------------------------------------------------- */
function showExpired(snack: MatSnackBar) {
  snack.open('Session expired. Please log in again.', 'Close', {
    duration: 4000,
    panelClass: ['snackbar-expired'],
    horizontalPosition: 'right',
    verticalPosition: 'top',
  });
}
