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
  let payload: any;

  try {
    payload = JSON.parse(atob(token.split('.')[1]));
    role = payload.roleName || payload.role || payload.roles || payload.authorities || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    
    // Handle array of roles
    if (Array.isArray(role)) {
      role = role[0];
    }
    
    // Handle Spring Security format
    if (typeof role === 'object' && role !== null && (role as any).authority) {
      role = (role as any).authority;
    }
    
    // Remove ROLE_ prefix if present
    if (role && typeof role === 'string' && role.startsWith('ROLE_')) {
      role = role.substring(5);
    }
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
  // Check allowed permissions or roles defined on the route
  // -------------------------------------------
  const requiredPermissions = (route.data['permissions'] as string[]) ?? [];

  if (role === 'SUPER_ADMIN') {
    return true;
  }

  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.every(p => authSrv.hasPermission(p));
    if (hasPermission) {
      return true;
    }
  }

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
