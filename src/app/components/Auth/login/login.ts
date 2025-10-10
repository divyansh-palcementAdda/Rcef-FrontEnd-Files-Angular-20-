// src/app/components/Auth/login/login.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JWTResponseDTO } from '../../../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../../../Model/login-request-dto';

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
    private authService: AuthApiService
  ) {
    this.loginForm = this.fb.group({
      emailOrUsername: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (token && !this.isTokenExpired(token)) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.authService.dashboard(payload);
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() > payload.exp * 1000;
    } catch {
      return true;
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

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
      catchError((err: Error) => {
        this.isLoading = false;
        this.validationErrors.push(err.message);
        return of(null);
      })
    ).subscribe((response: JWTResponseDTO | null) => {
      this.isLoading = false;

      if (response) {
        localStorage.setItem('token', response.token);
        this.authService['loggedIn'].next(true);
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', emailOrUsername);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        const payload = JSON.parse(atob(response.token.split('.')[1]));
        this.authService.dashboard(payload);
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  private collectValidationErrors(): void {
    this.validationErrors = [];
    const emailCtrl = this.loginForm.get('emailOrUsername');
    if (emailCtrl?.touched && emailCtrl.errors?.['required']) {
      this.validationErrors.push('Email or Username is required');
    }
    const pwdCtrl = this.loginForm.get('password');
    if (pwdCtrl?.touched && pwdCtrl.errors) {
      if (pwdCtrl.errors['required']) this.validationErrors.push('Password is required');
      if (pwdCtrl.errors['minlength']) this.validationErrors.push('Password must be at least 6 characters long');
    }
  }
}
