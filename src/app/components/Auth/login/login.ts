// src/app/components/Auth/login/login.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, of, tap } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { JWTResponseDTO } from '../../../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../../../Model/login-request-dto';
import { AuthApiService } from '../../../Services/auth-api-service';
import { NotificationService } from '../../../Services/notification-service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
  ],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthApiService);
  private readonly notificationService = inject(NotificationService);

  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  validationErrors: string[] = [];

  // Optional: background animation
  particles = Array(8).fill(0).map((_, i) => i);

  constructor() {
    this.buildForm();
  }

  ngOnInit(): void {
    // Auto-redirect if already logged in
    if (this.authService.getAccessToken()) {
      this.authService.goToDashboard();
      return;
    }

    // Remember me
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      this.loginForm.patchValue({
        emailOrUsername: rememberedEmail,
        rememberMe: true,
      });
    }
  }

  private buildForm(): void {
    this.loginForm = this.fb.group({
      emailOrUsername: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }

  /* --------------------------------------------------------------------- */
  /* FORM SUBMIT */
  /* --------------------------------------------------------------------- */
  onSubmit(): void {
    this.validationErrors = [];

    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      this.collectValidationErrors();
      return;
    }

    this.isLoading = true;

    const { emailOrUsername, password, rememberMe } = this.loginForm.value;
    const loginRequest: LoginRequestDTO = { emailOrUsername, password };

    this.authService
      .login(loginRequest)
      .pipe(
        tap((response: JWTResponseDTO) => {
          this.handleLoginSuccess(response, rememberMe, emailOrUsername);
        }),
        catchError((error: Error) => {
          this.validationErrors = [error.message || 'Login failed. Please try again.'];
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe();
  }

  /* --------------------------------------------------------------------- */
  /* SUCCESS HANDLER */
  /* --------------------------------------------------------------------- */
  private handleLoginSuccess(
    response: JWTResponseDTO,
    rememberMe: boolean,
    emailOrUsername: string
  ): void {
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', emailOrUsername);
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    this.notificationService.init();
    this.authService.goToDashboard();
  }

  /* --------------------------------------------------------------------- */
  /* PASSWORD TOGGLE */
  /* --------------------------------------------------------------------- */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /* --------------------------------------------------------------------- */
  /* VALIDATION HELPERS */
  /* --------------------------------------------------------------------- */
  private markFormGroupTouched(): void {
    Object.values(this.loginForm.controls).forEach((control) => {
      control.markAsTouched();
    });
  }

  private collectValidationErrors(): void {
    const errors: string[] = [];

    const emailCtrl = this.loginForm.get('emailOrUsername');
    if (emailCtrl?.touched && emailCtrl.errors?.['required']) {
      errors.push('Email or Username is required.');
    }

    const pwdCtrl = this.loginForm.get('password');
    if (pwdCtrl?.touched) {
      if (pwdCtrl.errors?.['required']) {
        errors.push('Password is required.');
      }
      if (pwdCtrl.errors?.['minlength']) {
        errors.push('Password must be at least 6 characters long.');
      }
    }

    this.validationErrors = errors;
  }

  /* --------------------------------------------------------------------- */
  /* FORM GETTER */
  /* --------------------------------------------------------------------- */
  get f() {
    return this.loginForm.controls;
  }
}