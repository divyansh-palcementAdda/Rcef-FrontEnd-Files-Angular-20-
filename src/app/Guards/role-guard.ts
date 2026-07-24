import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthApiService } from '../Services/auth-api-service';

/**
 * Dynamic Permission and RBAC Route Guard.
 *
 * <p>Secures Angular routes based on dynamic backend permissions. It extracts
 * required permission codes from the route data and verifies them against the
 * current user's permission cache. Access is denied if the user is missing
 * any required permission, redirecting them to a friendly 403 Access Denied page.</p>
 */
export const RoleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
): boolean | UrlTree => {

  const router  = inject(Router);
  const snack   = inject(MatSnackBar);
  const authSrv = inject(AuthApiService);

  const token = authSrv.getAccessToken();

  if (!token) {
    snack.open('Session required. Please log in first.', 'Close', { duration: 3000 });
    return router.createUrlTree(['/login']);
  }

  const requiredPermissions = (route.data['permissions'] as string[]) ?? [];
  const allowedRoles = (route.data['roles'] as string[]) ?? [];
  const forbiddenRoles = (route.data['forbiddenRoles'] as string[]) ?? [];
  const userRole = authSrv.getCurrentRole();

  // Check explicitly forbidden roles first (takes precedence)
  if (userRole && forbiddenRoles.includes(userRole)) {
    snack.open('Access denied. Your role is not authorized to access this page.', 'Close', {
      duration: 4000,
      panelClass: ['snackbar-warn'],
    });
    return router.createUrlTree(['/access-denied']);
  }

  // SUPER_ADMIN gets a master bypass
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }

  // Role-based check (used for dashboard routes)
  if (allowedRoles.length > 0) {
    const userRole = authSrv.getCurrentRole();
    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }
  }

  // Permission-based check (used for feature routes)
  if (requiredPermissions.length > 0) {
    const requireAll = (route.data['requireAllPermissions'] as boolean) ?? false;
    const hasPermission = requireAll
      ? requiredPermissions.every(p => authSrv.hasPermission(p))
      : requiredPermissions.some(p => authSrv.hasPermission(p));
    if (hasPermission) {
      return true;
    }
  }

  // Deny access: redirect to /access-denied
  snack.open('Access denied. Insufficient permissions.', 'Close', {
    duration: 4000,
    panelClass: ['snackbar-warn'],
  });

  return router.createUrlTree(['/access-denied']);
};
