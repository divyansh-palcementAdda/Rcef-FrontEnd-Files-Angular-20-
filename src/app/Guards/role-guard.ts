import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const token = localStorage.getItem('token');
    if (!token) {
      return this.router.createUrlTree(['/login']);
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1])); // decode JWT payload
      const userRole = payload.role; // assuming 'role' field in payload
      if (!userRole) {
        return this.router.createUrlTree(['/login']);
      }
      const allowedRoles: string[] = route.data['roles'];
      if (allowedRoles.includes(userRole)) {
        return true; // ✅ authorized
      } else {
        alert('🚫 Access denied! You do not have permission.');
        return this.router.createUrlTree(['/home']);
      }
    } catch (e) {
      console.error('Error decoding token', e);
      return this.router.createUrlTree(['/login']);
    }
  }
}
