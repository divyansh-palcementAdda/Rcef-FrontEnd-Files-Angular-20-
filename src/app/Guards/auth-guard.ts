import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthApiService } from '../Services/auth-api-service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router, private authService: AuthApiService) {}

  canActivate():
    | boolean
    | UrlTree
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree> {

    const token = localStorage.getItem('token');

    if (token && !this.isTokenExpired(token)) {
      return true; 
    }

    // 🚨 No token or expired → redirect to login
     this.authService.logout();
      return false;
    // return this.router.createUrlTree(['/login']);
  }

  // ✅ Decode JWT and check expiration
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // exp is in seconds → convert to ms
      return Date.now() > exp;
    } catch (e) {
      console.error('Error decoding token', e);
      return true; // treat as expired if invalid
    }
  }
}
