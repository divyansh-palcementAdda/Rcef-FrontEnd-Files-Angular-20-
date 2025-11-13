// src/app/guards/role.guard.ts
import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthApiService } from '../Services/auth-api-service';

export const RoleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
): boolean | UrlTree => {

  const router  = inject(Router);
  const snack   = inject(MatSnackBar);
  const authSrv = inject(AuthApiService);

  const token = authSrv.getAccessToken();

  // -------------------------------------------
  // Case 1: No access token → user not logged in
  // (AuthGuard should catch this first, but be safe)
  // -------------------------------------------
  if (!token) {
    snack.open('Please log in first.', 'Close', { duration: 3000 });
    return router.createUrlTree(['/login']);
  }

  // -------------------------------------------
  // Decode token to read the role
  // NOTE: Token may be expired but still readable 
  // -------------------------------------------
  let role: string | undefined;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    role = payload.role;
  } catch (err) {
    console.error('[RoleGuard] Invalid JWT payload', err);
    snack.open('Invalid session. Please log in again.', 'Close', { duration: 3000 });
    // authSrv.logout();
    return router.createUrlTree(['/login']);
  }

  if (!role) {
    snack.open('No role found. Access denied.', 'Close', { duration: 3000 });
    return router.createUrlTree(['/login']);
  }

  // -------------------------------------------
  // Check allowed roles defined on the route
  // -------------------------------------------
  const allowedRoles = (route.data['roles'] as string[]) ?? [];

  if (allowedRoles.includes(role)) {
    return true;
  }

  // -------------------------------------------
  // Unauthorized role – redirect & notify
  // -------------------------------------------
  snack.open('Access denied. You do not have permission.', 'Close', {
    duration: 4000,
    panelClass: ['snackbar-warn'],
  });

  return router.createUrlTree(['/home']);
};
