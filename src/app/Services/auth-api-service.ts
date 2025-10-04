import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoginRequestDTO } from '../Model/login-request-dto';
import { BehaviorSubject, Observable, catchError, throwError } from 'rxjs';
import { JWTResponseDTO } from '../Model/jwtresponse-dto';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private loggedIn = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.loggedIn.asObservable();
  private username = new BehaviorSubject<string>("User");
  getUsername$ = this.username.asObservable();
  private apiUrl = 'http://localhost:8080/api';
  constructor(private http: HttpClient,private router:Router) {
    const token = localStorage.getItem('token');
    this.loggedIn.next(!!token);
  }
  logout() {
    localStorage.removeItem('token');
    this.loggedIn.next(false);
    this.router.navigate(['/login']);
  }

  login(loginRequest: LoginRequestDTO): Observable<JWTResponseDTO> {
    console.log('Login request:', loginRequest);
    return this.http.post<JWTResponseDTO>(`${this.apiUrl}/auth/login`, loginRequest).pipe(
      catchError(this.handleError('Login failed'))
    );
  }
  private handleError(message: string) {
    return (error: any): Observable<never> => {
      console.error(`${message}:`, error);
      return throwError(() => new Error(message));
    };
  }
  dashboard(payload: any) {
    const role = payload.role;
    // const username = payload.sub;
    // this.username.next(username);
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
