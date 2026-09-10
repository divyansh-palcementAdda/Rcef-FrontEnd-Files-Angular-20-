import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, catchError, of, delay } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { JWTResponseDTO } from '../../../Model/jwtresponse-dto';
import { LoginRequestDTO } from '../../../Model/login-request-dto';
import { AuthApiService } from '../../../Services/auth-api-service';
import { NotificationService } from '../../../Services/notification-service';

export type AuthViewMode = 'LOGIN' | 'FORGOT_PASSWORD' | 'OTP_SENT' | 'RESET_PASSWORD' | 'SUCCESS';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
  ],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.35s ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('0.2s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('0.15s ease-in', style({ opacity: 0 }))
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

  @ViewChild('loginFormElement') loginFormElement!: ElementRef;

  // View State Machine
  currentView: AuthViewMode = 'LOGIN';

  // Forms
  loginForm!: FormGroup;
  forgotPasswordForm!: FormGroup;
  otpForm!: FormGroup;
  resetPasswordForm!: FormGroup;

  // Segmented OTP Digits (6 boxes)
  otpDigits: string[] = ['', '', '', '', '', ''];

  // Visibility Toggles
  showPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  // Process States
  isLoading = false;
  validationErrors: string[] = [];
  successMessage = '';

  // Password Reset Context
  resetEmail = '';
  resetToken = '';

  // Resend OTP Cooldown Timer
  resendCooldown = 0;
  private resendInterval: any = null;

  ngOnInit(): void {
    this.buildForms();
    this.checkAuthStatus();
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* --------------------------------------------------------------------- */
  /* FORM BUILDERS                                                         */
  /* --------------------------------------------------------------------- */
  private buildForms(): void {
    // 1. Login Form
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

    // 2. Forgot Password Form
    this.forgotPasswordForm = this.fb.group({
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.maxLength(150)
      ]]
    });

    // 3. OTP Form
    this.otpForm = this.fb.group({
      otp: ['', [
        Validators.required,
        Validators.pattern('^[0-9]{6}$')
      ]]
    });

    // 4. Reset Password Form
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(64)
      ]],
      confirmPassword: ['', [
        Validators.required
      ]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
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
  /* VIEW SWITCHING                                                        */
  /* --------------------------------------------------------------------- */
  switchView(view: AuthViewMode): void {
    this.isLoading = false;
    this.validationErrors = [];
    this.successMessage = '';
    this.currentView = view;
  }

  backToLogin(): void {
    this.clearResendTimer();
    this.isLoading = false;
    this.resetEmail = '';
    this.resetToken = '';
    this.otpDigits = ['', '', '', '', '', ''];
    this.forgotPasswordForm.reset();
    this.otpForm.reset();
    this.resetPasswordForm.reset();
    this.switchView('LOGIN');
  }

  /* --------------------------------------------------------------------- */
  /* LOGIN FLOW                                                            */
  /* --------------------------------------------------------------------- */
  onSubmit(): void {
    this.validationErrors = [];

    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      this.collectLoginValidationErrors();
      this.shakeForm();
      return;
    }

    this.isLoading = true;
    const { emailOrUsername, password, rememberMe } = this.loginForm.value;
    const loginRequest: LoginRequestDTO = { emailOrUsername, password };

    this.authService.login(loginRequest)
      .pipe(
        delay(600),
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
    }, 1200);
  }

  private handleLoginError(error: any): void {
    let msg = 'Login failed. Please check your credentials.';
    if (error.status === 401) {
      msg = 'Invalid email/username or password.';
    } else if (error.status === 403) {
      msg = 'Account is disabled. Please contact support.';
    } else if (error.status === 429) {
      msg = 'Too many attempts. Please try again later.';
    } else if (error.status === 0) {
      msg = 'Network error. Please check your connection.';
    } else if (error.message) {
      msg = error.message;
    }
    this.validationErrors = [msg];
    this.shakeForm();
  }

  /* --------------------------------------------------------------------- */
  /* FORGOT PASSWORD FLOW                                                  */
  /* --------------------------------------------------------------------- */
  onForgotPasswordSubmit(): void {
    this.validationErrors = [];
    this.successMessage = '';

    if (this.forgotPasswordForm.invalid) {
      this.markFormGroupTouched(this.forgotPasswordForm);
      if (this.forgotPasswordForm.get('email')?.errors?.['required']) {
        this.validationErrors = ['Email address is required'];
      } else if (this.forgotPasswordForm.get('email')?.errors?.['email']) {
        this.validationErrors = ['Please enter a valid email address'];
      }
      this.shakeForm();
      return;
    }

    this.isLoading = true;
    const email = this.forgotPasswordForm.value.email.trim();

    this.authService.forgotPassword(email)
      .pipe(
        delay(600),
        catchError((error: any) => {
          this.validationErrors = [error.message || 'Failed to request password reset.'];
          this.shakeForm();
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (res) => {
          if (res) {
            this.resetEmail = email;
            this.otpDigits = ['', '', '', '', '', ''];
            this.otpForm.reset();
            this.startResendTimer(30);
            this.switchView('OTP_SENT');
            setTimeout(() => {
              const firstInput = document.getElementById('otp-cell-0') as HTMLInputElement;
              firstInput?.focus();
            }, 200);
          }
        }
      });
  }

  /* --------------------------------------------------------------------- */
  /* SEGMENTED OTP INPUT HANDLERS                                          */
  /* --------------------------------------------------------------------- */
  onOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value;

    // Filter non-digits
    val = val.replace(/\D/g, '');

    if (val.length > 1) {
      this.otpDigits[index] = val.charAt(val.length - 1);
      input.value = this.otpDigits[index];
    } else {
      this.otpDigits[index] = val;
      input.value = val;
    }

    this.syncOtpForm();

    // Auto-advance to next box
    if (this.otpDigits[index] && index < 5) {
      const nextInput = document.getElementById(`otp-cell-${index + 1}`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  }

  onOtpKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      if (!this.otpDigits[index] && index > 0) {
        const prevInput = document.getElementById(`otp-cell-${index - 1}`) as HTMLInputElement;
        if (prevInput) {
          this.otpDigits[index - 1] = '';
          prevInput.value = '';
          this.syncOtpForm();
          prevInput.focus();
          prevInput.select();
        }
      } else {
        this.otpDigits[index] = '';
        const curInput = document.getElementById(`otp-cell-${index}`) as HTMLInputElement;
        if (curInput) curInput.value = '';
        this.syncOtpForm();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.getElementById(`otp-cell-${index - 1}`) as HTMLInputElement;
      prevInput?.focus();
      prevInput?.select();
    } else if (event.key === 'ArrowRight' && index < 5) {
      const nextInput = document.getElementById(`otp-cell-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
      nextInput?.select();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    if (digits) {
      for (let i = 0; i < 6; i++) {
        this.otpDigits[i] = digits[i] || '';
        const el = document.getElementById(`otp-cell-${i}`) as HTMLInputElement;
        if (el) el.value = this.otpDigits[i];
      }
      this.syncOtpForm();
      const lastIndex = Math.min(digits.length, 5);
      const targetInput = document.getElementById(`otp-cell-${lastIndex}`) as HTMLInputElement;
      targetInput?.focus();
    }
  }

  private syncOtpForm(): void {
    const fullOtp = this.otpDigits.join('');
    this.otpForm.get('otp')?.setValue(fullOtp);
    this.otpForm.get('otp')?.markAsDirty();
  }

  /* --------------------------------------------------------------------- */
  /* VERIFY RESET OTP FLOW                                                 */
  /* --------------------------------------------------------------------- */
  onVerifyOtpSubmit(): void {
    this.validationErrors = [];
    this.successMessage = '';

    const otp = this.otpDigits.join('').trim();
    if (!otp || otp.length < 6 || !/^\d{6}$/.test(otp)) {
      this.validationErrors = ['Please enter the complete 6-digit verification code'];
      this.shakeForm();
      return;
    }

    this.isLoading = true;

    this.authService.verifyResetOtp(this.resetEmail, otp)
      .pipe(
        delay(600),
        catchError((error: any) => {
          this.validationErrors = [error.message || 'Invalid or expired OTP.'];
          this.shakeForm();
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (res) => {
          if (res && res.resetToken) {
            this.resetToken = res.resetToken;
            this.resetPasswordForm.reset();
            this.switchView('RESET_PASSWORD');
          }
        }
      });
  }

  /* --------------------------------------------------------------------- */
  /* RESEND RESET OTP FLOW                                                 */
  /* --------------------------------------------------------------------- */
  onResendOtp(): void {
    if (this.resendCooldown > 0 || this.isLoading || !this.resetEmail) {
      return;
    }

    this.validationErrors = [];
    this.isLoading = true;

    this.authService.resendResetOtp(this.resetEmail)
      .pipe(
        delay(400),
        catchError((error: any) => {
          this.validationErrors = [error.message || 'Failed to resend OTP.'];
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (res) => {
          if (res) {
            this.successMessage = 'A fresh OTP has been sent to your email.';
            this.otpDigits = ['', '', '', '', '', ''];
            for (let i = 0; i < 6; i++) {
              const el = document.getElementById(`otp-cell-${i}`) as HTMLInputElement;
              if (el) el.value = '';
            }
            this.syncOtpForm();
            this.startResendTimer(30);
            setTimeout(() => {
              const firstInput = document.getElementById('otp-cell-0') as HTMLInputElement;
              firstInput?.focus();
            }, 100);
          }
        }
      });
  }

  private startResendTimer(seconds: number): void {
    this.clearResendTimer();
    this.resendCooldown = seconds;
    this.resendInterval = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        this.clearResendTimer();
      }
    }, 1000);
  }

  private clearResendTimer(): void {
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
      this.resendInterval = null;
    }
    this.resendCooldown = 0;
  }

  /* --------------------------------------------------------------------- */
  /* RESET PASSWORD FINAL SUBMISSION                                       */
  /* --------------------------------------------------------------------- */
  onResetPasswordSubmit(): void {
    this.validationErrors = [];
    this.successMessage = '';

    if (!this.resetToken) {
      this.validationErrors = ['Session expired. Please request a new OTP.'];
      this.switchView('FORGOT_PASSWORD');
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.markFormGroupTouched(this.resetPasswordForm);
      const newPassCtrl = this.resetPasswordForm.get('newPassword');
      const confirmPassCtrl = this.resetPasswordForm.get('confirmPassword');

      if (newPassCtrl?.errors?.['required']) {
        this.validationErrors.push('New password is required');
      } else if (newPassCtrl?.errors?.['minlength']) {
        this.validationErrors.push('Password must be at least 8 characters');
      }

      if (confirmPassCtrl?.errors?.['required']) {
        this.validationErrors.push('Please confirm your new password');
      }

      if (this.resetPasswordForm.errors?.['passwordMismatch']) {
        this.validationErrors.push('Passwords do not match');
      }

      this.shakeForm();
      return;
    }

    this.isLoading = true;
    const { newPassword, confirmPassword } = this.resetPasswordForm.value;

    this.authService.resetPassword({
      resetToken: this.resetToken,
      newPassword,
      confirmPassword
    })
      .pipe(
        delay(600),
        catchError((error: any) => {
          this.validationErrors = [error.message || 'Failed to reset password. Please start again.'];
          this.shakeForm();
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (res) => {
          if (res) {
            this.switchView('SUCCESS');
          }
        }
      });
  }

  /* --------------------------------------------------------------------- */
  /* UI HELPERS & TOGGLES                                                  */
  /* --------------------------------------------------------------------- */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  clearErrors(): void {
    this.validationErrors = [];
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  private collectLoginValidationErrors(): void {
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

  // Getters
  get f() {
    return this.loginForm.controls;
  }

  get fp() {
    return this.forgotPasswordForm.controls;
  }

  get op() {
    return this.otpForm.controls;
  }

  get rp() {
    return this.resetPasswordForm.controls;
  }
}