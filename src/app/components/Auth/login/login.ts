import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, HostListener, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, finalize, catchError, of, delay } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
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
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.5s ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)', height: 0 }),
        animate('0.3s ease-out',
          style({ opacity: 1, transform: 'translateY(0)', height: '*' }))
      ]),
      transition(':leave', [
        animate('0.3s ease-in',
          style({ opacity: 0, transform: 'translateY(-20px)', height: 0 }))
      ])
    ])
  ]
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly renderer = inject(Renderer2);
  private readonly destroy$ = new Subject<void>();
  errorMessage = '';

  @ViewChild('loginFormElement') loginFormElement!: ElementRef;

  // Form State
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  validationErrors: string[] = [];
  successMessage = '';
  showShortcutsHint = true;

  // Animation Particles
  private readonly particleCount = 20;

  // Logo fallback
  logoLoaded = false;
  logoError = false;

  ngOnInit(): void {
    this.buildForm();
    this.checkAuthStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildForm(): void {
    this.loginForm = this.fb.group({
      emailOrUsername: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(150)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(128)
      ]],
      rememberMe: [false]
    });

    this.loginForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.loginForm.valid) {
          this.saveFormState();
        }
      });
  }

  private checkAuthStatus(): void {
    if (this.authService.getAccessToken()) {
      this.authService.goToDashboard();
      return;
    }

    const rememberedEmail = localStorage.getItem('rememberedEmail');
    const formState = sessionStorage.getItem('loginFormState');

    if (rememberedEmail) {
      this.loginForm.patchValue({
        emailOrUsername: rememberedEmail,
        rememberMe: true
      });
    } else if (formState) {
      try {
        const state = JSON.parse(formState);
        this.loginForm.patchValue(state);
      } catch (e) {
        sessionStorage.removeItem('loginFormState');
      }
    }
  }

  private saveFormState(): void {
    const { emailOrUsername, rememberMe } = this.loginForm.value;
    sessionStorage.setItem('loginFormState', JSON.stringify({ emailOrUsername, rememberMe }));
  }


  /* --------------------------------------------------------------------- */
  /* FORM SUBMISSION */
  /* --------------------------------------------------------------------- */
  onSubmit(): void {
    this.validationErrors = [];

    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      this.collectValidationErrors();
      this.shakeForm();
      return;
    }

    this.isLoading = true;
    const { emailOrUsername, password, rememberMe } = this.loginForm.value;
    const loginRequest: LoginRequestDTO = { emailOrUsername, password };

    this.authService.login(loginRequest)
      .pipe(
        delay(800), // Simulate network delay for better UX
        catchError((error: any) => {
          this.handleLoginError(error);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response: JWTResponseDTO | null) => {
          if (response) {
            this.handleLoginSuccess(response, rememberMe, emailOrUsername);
          }
        }
      });
  }

  private handleLoginSuccess(
    response: JWTResponseDTO,
    rememberMe: boolean,
    emailOrUsername: string
  ): void {
    // Handle remember me
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', emailOrUsername);
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMe');
    }

    sessionStorage.removeItem('loginFormState');

    this.successMessage = 'Login successful! Redirecting to dashboard...';

    setTimeout(() => {
      this.notificationService.init();
      this.authService.goToDashboard();
    }, 1500);
  }

  private handleLoginError(error: any): void {
    this.errorMessage = 'Login failed. Please check your credentials.';

    if (error.status === 401) {
      this.errorMessage = 'Invalid email/username or password.';
    } else if (error.status === 403) {
      this.errorMessage = 'Account is disabled. Please contact support.';
    } else if (error.status === 429) {
      this.errorMessage = 'Too many attempts. Please try again in 15 minutes.';
    } else if (error.status === 0) {
      this.errorMessage = 'Network error. Please check your connection.';
    } else if (error.message) {
      this.errorMessage = error.message;
    }

    this.validationErrors = [this.errorMessage];
    this.shakeForm();
  }



  /* --------------------------------------------------------------------- */
  /* UI INTERACTIONS */
  /* --------------------------------------------------------------------- */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  clearErrors(): void {
    this.validationErrors = [];
  }

  /* --------------------------------------------------------------------- */
  /* VALIDATION HELPERS */
  /* --------------------------------------------------------------------- */
  private markFormGroupTouched(): void {
    Object.values(this.loginForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  private collectValidationErrors(): void {
    const errors: string[] = [];
    const emailCtrl = this.f['emailOrUsername'];
    const passwordCtrl = this.f['password'];

    if (emailCtrl.errors?.['required']) {
      errors.push('Email or username is required');
    } else if (emailCtrl.errors?.['minlength']) {
      errors.push('Email/username must be at least 3 characters');
    }

    if (passwordCtrl.errors?.['required']) {
      errors.push('Password is required');
    } else if (passwordCtrl.errors?.['minlength']) {
      errors.push('Password must be at least 6 characters');
    }

    this.validationErrors = errors;
  }

  private shakeForm(): void {
    const form = this.loginFormElement?.nativeElement;
    if (form) {
      this.renderer.addClass(form, 'shake');
      setTimeout(() => {
        this.renderer.removeClass(form, 'shake');
      }, 500);
    }
  }

  /* --------------------------------------------------------------------- */
  /* LOGO HANDLING */
  /* --------------------------------------------------------------------- */
  onLogoLoad(): void {
    this.logoLoaded = true;
    this.logoError = false;
  }

  onLogoError(): void {
    this.logoLoaded = false;
    this.logoError = true;
  }

  /* --------------------------------------------------------------------- */
  /* FORM GETTER */
  /* --------------------------------------------------------------------- */
  get f() {
    return this.loginForm.controls;
  }
}