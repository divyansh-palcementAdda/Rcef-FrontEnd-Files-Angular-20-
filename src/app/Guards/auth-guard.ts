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
    authSrv.clearAuthAndRedirect();
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
  // CASE 3: Access token exists — check if it is expired
  // If expired but refresh token present, interceptor will handle it.
  // If expired AND no refresh token → force logout.
  // --------------------------------------------------------------
  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();

      if (isExpired && !refreshToken) {
        // Both tokens effectively gone — force logout
        showExpired(snack);
        authSrv.clearAuthAndRedirect();
        return router.createUrlTree(['/login']);
      }
      // Expired but refresh token exists → interceptor will refresh on first API call
    } catch {
      // Malformed token — treat as unauthenticated
      showExpired(snack);
      authSrv.clearAuthAndRedirect();
      return router.createUrlTree(['/login']);
    }
  }

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
