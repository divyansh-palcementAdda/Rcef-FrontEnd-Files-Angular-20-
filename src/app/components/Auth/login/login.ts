import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JWTResponseDTO } from '../../../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../../../Model/login-request-dto';
import { HttpErrorResponse } from '@angular/common/http';
import { JwtService } from '../../../Services/jwt-service';
import { NotificationService } from '../../../Services/notification-service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;
  validationErrors: string[] = [];
  particles: number[] = Array(8).fill(0).map((_, i) => i);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthApiService,
    private jwtService: JwtService,
    private notificationService:NotificationService
  ) {
    this.loginForm = this.fb.group({
      emailOrUsername: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  // -------------------------------------------------
  // ✅ Auto-redirect if already logged in and token valid
  // -------------------------------------------------
  ngOnInit(): void {
    const token = this.jwtService.getAccessToken();
    if (token && this.jwtService.isTokenValid(token)) {
      const decoded = this.jwtService.decodeToken(token);
      this.authService.goToDashboard();
    }

    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      this.loginForm.patchValue({ emailOrUsername: rememberedEmail });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // -------------------------------------------------
  // ✅ Handle Login Submit
  // -------------------------------------------------
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      this.collectValidationErrors();
      return;
    }

    this.isLoading = true;
    this.validationErrors = [];

    const { emailOrUsername, password, rememberMe } = this.loginForm.value;
    const loginRequest: LoginRequestDTO = { emailOrUsername, password };

    this.authService.login(loginRequest).pipe(
      catchError((error: HttpErrorResponse | Error) => {
        this.isLoading = false;

        let message = 'Login failed. Please try again.';
        if (error instanceof HttpErrorResponse) {
          message = error.error?.message || message;
        } else if (error.message) {
          message = error.message;
        }

        this.validationErrors = [message];
        return of(null);
      })
    ).subscribe((response: JWTResponseDTO | null) => {
      this.isLoading = false;

      if (response) {
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken); // Ensure saved
        // localStorage.setItem('user', JSON.stringify(response));
        this.authService['loggedIn'].next(true); // Better: use public method if possible
this.notificationService.init();

        if (rememberMe) {
          localStorage.setItem('rememberedEmail', emailOrUsername);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        this.authService.goToDashboard();
      }
    });
  }

  // -------------------------------------------------
  // ✅ Validation helpers
  // -------------------------------------------------
  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  private collectValidationErrors(): void {
    this.validationErrors = [];

    const emailCtrl = this.loginForm.get('emailOrUsername');
    if (emailCtrl?.touched && emailCtrl.errors?.['required']) {
      this.validationErrors.push('Email or Username is required.');
    }

    const pwdCtrl = this.loginForm.get('password');
    if (pwdCtrl?.touched && pwdCtrl.errors) {
      if (pwdCtrl.errors['required']) {
        this.validationErrors.push('Password is required.');
      }
      if (pwdCtrl.errors['minlength']) {
        this.validationErrors.push('Password must be at least 6 characters long.');
      }
    }
  }
}
