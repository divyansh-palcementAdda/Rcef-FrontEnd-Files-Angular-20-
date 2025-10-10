import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoginRequestDTO } from '../Model/login-request-dto';
import { BehaviorSubject, Observable, catchError, throwError } from 'rxjs';
import { JWTResponseDTO } from '../Model/jwtresponse-dto';
import { Router } from '@angular/router';
import { environment } from '../environment/environment';


@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private loggedIn = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.loggedIn.asObservable();
  private username = new BehaviorSubject<string>("User");
  getUsername$ = this.username.asObservable();
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient, private router: Router) {
    const token = localStorage.getItem('token');
    this.loggedIn.next(!!token);
  }
  logout() {
    localStorage.removeItem('token');
    this.loggedIn.next(false);
    this.router.navigate(['/login']);
  }

  login(loginRequest: LoginRequestDTO): Observable<JWTResponseDTO> {
    return this.http.post<JWTResponseDTO>(`${this.apiUrl}/auth/login`, loginRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMsg = 'Login failed. Please try again.';

        if (error.status === 404 || error.error?.message?.includes('User not found')) {
          errorMsg = '❌ The username you entered does not exist.';
        }
        else if (error.status === 401 || error.error?.message?.includes('Invalid credentials')) {
          errorMsg = '❌ Incorrect password. Please check your password and try again.';
        }
        else if (error.error?.message) {
          errorMsg = error.error.message;
        }

        return throwError(() => new Error(errorMsg));
      })
    );
  }

  onHomeClick() {
    if (this.isLoggedIn$) {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.dashboard(payload);
      } else {
        // alert("It seems you are not logged in... Redirecting to Home page.");
        this.router.navigate(['/']);
      }
    } else {
      alert("You are not logged in");
      this.router.navigate(['/login']);
    }
  }

  dashboard(payload: any) {
    const role = payload.role;
    console.log('Navigating to dashboard for role:', role);
    if (role === 'ADMIN') {
      this.router.navigate(['/admin']);
    } else if (role === 'HOD') {
      this.router.navigate(['/hod']);
    } else if (role === 'TEACHER') {
      this.router.navigate(['/teacher']);
    } else {
      alert('🚫 Unknown role! Access denied.');
      this.logout();
      this.router.navigate(['/login']);
    }
  }
}
