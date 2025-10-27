import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './add-user.html',
  styleUrls: ['./add-user.css']
})
export class AddUserComponent implements OnInit {
  userForm: FormGroup;
  isSubmitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  roles = ['HOD', 'TEACHER'];
  departments: any[] = [];

  showPassword = false;
  passwordStrength = { score: 0, label: '', color: '' };

  // OTP
  otpSent = false;
  otpValidated = false;
  otpInput = '';
  verifiedEmail: string | null = null; // ✅ store verified email

  constructor(
    private fb: FormBuilder,
    private departmentApiService: DepartmentApiService,
    private apiService: ApiService,
    private userApiService: UserApiService,
    private router: Router
  ) {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64), Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!])(?=\S+$).{8,64}$/)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(200), Validators.pattern(/^[A-Za-z0-9+_.-]+@[A-Za-z.]+$/)]],
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80), Validators.pattern(/^[A-Za-z]+([ '-][A-Za-z]+)*$/)]],
      role: ['', Validators.required],
      departmentId: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.userForm.get('password')?.valueChanges.subscribe(value => {
      this.passwordStrength = this.evaluatePasswordStrength(value || '');
    });
  }

  loadDepartments(): void {
  this.departmentApiService.getAllDepartments().subscribe({
    next: (data) => {
      this.departments = data.filter(
        (dept: any) => dept.name?.toLowerCase() !== 'adminstration'
      );
    },
    error: (err) => console.error('Failed to load departments', err)
  });
}


  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  evaluatePasswordStrength(password: string): { score: number; label: string; color: string } {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[@#$%^&+=!]/.test(password)) score += 1;

    if (score <= 2) return { score: 20, label: 'Weak', color: '#e74a3b' };
    if (score === 3 || score === 4) return { score: 60, label: 'Medium', color: '#f6c23e' };
    return { score: 100, label: 'Strong', color: '#1cc88a' };
  }

  /** Send OTP */
sendOtp(): void {
  const email = this.userForm.value.email;
  if (!email) {
    this.errorMessage = 'Please enter an email first';
    return;
  }

  this.apiService.sendOtp({ email }).subscribe({
    next: (res: any) => {
      // ✅ OTP sent successfully
      if (res.success && res.status === 'OTP_SENT') {
        this.successMessage = res.message;
        this.otpSent = true;
        this.errorMessage = null;
      }
    },
    error: (err) => {
      const response = err.error;
      const message = response?.message || 'Failed to send OTP';

      // 🟡 1️⃣ Detect inactive user case
      if (message.includes('inactive on user id')) {
        // 🔍  Extract user ID using regex
        const match = message.match(/user id (\d+)/);
        const userId = match ? Number(match[1]) : null;

        const confirmRedirect = confirm(
          `${message}\n\nDo you want to view and activate this user?`
        );

        if (confirmRedirect && userId) {
          // 🟢 Fetch user first before redirecting
          this.userApiService.getUserById(userId).subscribe({
            next: (user) => {
              console.log('Fetched user:', user);
              this.router.navigate(['/user', userId]);
            },
            error: (fetchError) => {
              console.error('Failed to fetch user before redirect:', fetchError);
              alert('Failed to fetch user details. Please try again.');
            }
          });
        } else if (!userId) {
          alert('Could not extract user ID from response.');
        }
        return;
      }

      // 🔴 2️⃣ If email already active
      if (message.includes('already registered with an active user')) {
        alert(message);
        return;
      }

      // ⚪ 3️⃣ Other errors
      this.errorMessage = message;
    }
  });
}

  /** Verify OTP */
  verifyOtp(): void {
    const email = this.userForm.value.email;
    if (!this.otpInput) {
      this.errorMessage = 'Please enter the OTP';
      return;
    }

    this.apiService.validateOtp({ email, otp: this.otpInput }).subscribe({
      next: () => {
        this.successMessage = 'OTP verified successfully!';
        this.otpValidated = true;
        this.verifiedEmail = email; // ✅ Lock the verified email
        this.userForm.get('email')?.disable(); // ✅ Disable input to prevent UI changes
        this.errorMessage = null;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Invalid OTP';
        this.otpValidated = false;
      }
    });
  }

  /** Submit form */
  onSubmit(): void {
    if (!this.otpValidated) {
      this.errorMessage = 'OTP must be verified before creating a user';
      return;
    }

    if (this.userForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form.';
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = {
      ...this.userForm.getRawValue(), // getRawValue() includes disabled fields
      email: this.verifiedEmail // ✅ Always send only verified email
    };

    this.userApiService.createUser(payload).subscribe({
      next: () => {
        this.successMessage = '✅ User created successfully!';
        this.isSubmitting = false;
        this.userForm.reset();
        this.passwordStrength = { score: 0, label: '', color: '' };
        this.otpSent = false;
        this.otpValidated = false;
        this.otpInput = '';
        this.verifiedEmail = null;
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to create user.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/users']);
  }
}
