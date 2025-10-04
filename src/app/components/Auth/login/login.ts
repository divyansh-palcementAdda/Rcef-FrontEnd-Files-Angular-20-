import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JWTResponseDTO } from '../../../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../../../Model/login-request-dto';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  standalone: true
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
      // alert('✅ You are already logged in! Redirecting to dashboard...');
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.authService.dashboard(payload);
      return; // ✅ Stop further login form setup
    }

    // // Restore remembered email
    // const savedEmail = localStorage.getItem('rememberedEmail');
    // if (savedEmail) {
    //   this.loginForm.patchValue({
    //     emailOrUsername: savedEmail,
    //     rememberMe: true
    //   });
    // }
  }

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

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.validationErrors = [];

      const { emailOrUsername, password, rememberMe } = this.loginForm.value;
      const loginRequest: LoginRequestDTO = { emailOrUsername, password };

      this.authService.login(loginRequest).pipe(
        catchError(err => {
          this.isLoading = false;
          console.error('Login failed', err);
          this.validationErrors.push(err?.error?.message || 'Login failed. Please try again.');
          return of(null);
        })
      ).subscribe((response: JWTResponseDTO | null) => {
        if (response) {
          // ✅ Store token
          localStorage.setItem('token', response.token);

          // ✅ Update service state
          this.authService['username'].next(response.username);
          this.authService['loggedIn'].next(true);

          // ✅ Remember email only
          if (rememberMe) {
            localStorage.setItem('rememberedEmail', emailOrUsername);
          } else {
            localStorage.removeItem('rememberedEmail');
          }

          this.isLoading = false;

          alert(`🎉 Welcome back, ${response.username}! Login successful.`);
          this.dashboard(response);
        }
      });
    } else {
      this.markFormGroupTouched();
      this.collectValidationErrors();
    }
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

  private dashboard(response: JWTResponseDTO): void {
    const payload = JSON.parse(atob(response.token.split('.')[1]));
    this.authService.dashboard(payload); // ✅ handle role-based redirect in AuthApiService
  }
}
