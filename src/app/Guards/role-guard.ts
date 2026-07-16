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

  // SUPER_ADMIN gets a master bypass
  if (authSrv.getCurrentRole() === 'SUPER_ADMIN') {
    return true;
  }

  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.every(p => authSrv.hasPermission(p));
    if (hasPermission) {
      return true;
    }
  }

  // Fallback to allowedRoles for backward compatibility if defined on route,
  // but log a warning encouraging permission-based guards.
  const allowedRoles = (route.data['roles'] as string[]) ?? [];
  if (allowedRoles.length > 0) {
    const userRole = authSrv.getCurrentRole();
    if (userRole && allowedRoles.includes(userRole)) {
      console.warn(`[SECURITY] Route ${route.routeConfig?.path} accessed via deprecated role guard. Migrate to permissions.`);
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
