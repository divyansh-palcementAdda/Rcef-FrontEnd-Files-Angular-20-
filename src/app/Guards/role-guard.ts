// src/app/guards/role.guard.ts
import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

export const RoleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
): boolean | UrlTree => {
  const router = inject(Router);
  const snack  = inject(MatSnackBar);

  const token = localStorage.getItem('accessToken');
  if (!token) {
    // Should never happen – AuthGuard runs first – but be safe
    return router.createUrlTree(['/login']);
  }

  let role: string;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    role = payload.role;
  } catch (e) {
    console.error('Failed to decode JWT for role check', e);
    snack.open('Invalid session. Logging you out.', 'Close', { duration: 3000 });
    // localStorage.clear();
    return router.createUrlTree(['/login']);
  }

  if (!role) {
    snack.open('No role found in token.', 'Close', { duration: 3000 });
    return router.createUrlTree(['/login']);
  }

  const allowed = (route.data['roles'] as string[] | undefined) ?? [];
  if (allowed.includes(role)) {
    return true;
  }

  // --------------------------------------------------------------------
  // Unauthorized role
  // --------------------------------------------------------------------
  snack.open('Access denied! You do not have permission.', 'Close', {
    duration: 4000,
    panelClass: ['snackbar-warn'],
  });
  return router.createUrlTree(['/home']);
};