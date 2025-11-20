import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuthApiService } from '../../../Services/auth-api-service';

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
  selectedDepartments: number[] = [];
  searchQuery: string = '';

  showPassword = false;
  passwordStrength = { score: 0, label: '', color: '' };

  // OTP
  otpSent = false;
  otpValidated = false;
  otpInput = '';
  verifiedEmail: string | null = null;

  constructor(
    private fb: FormBuilder,
    private departmentApiService: DepartmentApiService,
    private apiService: ApiService,
    private userApiService: UserApiService,
    private router: Router,
    private authApiService: AuthApiService
  ) {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64), Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!]).{8,64}$/)]],
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]{3,}$/)]],
      role: ['', Validators.required],
      departmentIds: [[], Validators.required]
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
      next: (data) => (this.departments = data),
      error: (err) => console.error('Failed to load departments', err)
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  evaluatePasswordStrength(password: string) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[@#$%^&+=!]/.test(password)) score++;
    if (score <= 2) return { score: 20, label: 'Weak', color: '#e74a3b' };
    if (score <= 4) return { score: 60, label: 'Medium', color: '#f6c23e' };
    return { score: 100, label: 'Strong', color: '#1cc88a' };
  }

  filteredDepartments() {
    if (!this.searchQuery.trim()) return this.departments;
    return this.departments.filter((d) =>
      d.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  updateDepartmentSelection(event: any, deptId: number) {
    const role = this.userForm.get('role')?.value;

    if (role === 'ADMIN') {
      const adminDept = this.departments.find(
        (d) => d.name.toLowerCase() === 'administration'
      );
      this.selectedDepartments = adminDept ? [adminDept.departmentId] : [];
    } else if (role === 'HOD') {
      this.selectedDepartments = event.target.checked ? [deptId] : [];
    } else {
      if (event.target.checked) {
        if (!this.selectedDepartments.includes(deptId)) {
          this.selectedDepartments.push(deptId);
        }
      } else {
        this.selectedDepartments = this.selectedDepartments.filter((id) => id !== deptId);
      }
    }

    this.userForm.get('departmentIds')?.setValue(this.selectedDepartments);
  }

  isDeptDisabled(dept: any): boolean {
    const role = this.userForm.get('role')?.value;
    if (role === 'ADMIN' && dept.name.toLowerCase() !== 'administration') return true;
    if (role === 'HOD' && this.selectedDepartments.length >= 1 && !this.selectedDepartments.includes(dept.departmentId))
      return true;
    return false;
  }

  /** OTP Send */
  sendOtp(): void {
    const email = this.userForm.value.email;
    if (!email) {
      this.errorMessage = 'Please enter an email first';
      return;
    }

    this.apiService.sendOtp({ email }).subscribe({
      next: (res: any) => {
        if (res.success && res.status === 'OTP_SENT') {
          this.successMessage = res.message;
          this.otpSent = true;
          this.errorMessage = null;
        }
      },
      error: (err) => (this.errorMessage = err.error?.message || 'Failed to send OTP')
    });
  }

  /** OTP Verify */
  verifyOtp(): void {
    const email = this.userForm.value.email;
    if (!this.otpInput) {
      this.errorMessage = 'Please enter OTP';
      return;
    }

    this.apiService.validateOtp({ email, otp: this.otpInput }).subscribe({
      next: () => {
        this.successMessage = 'OTP verified successfully!';
        this.otpValidated = true;
        this.verifiedEmail = email;
        this.userForm.get('email')?.disable();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Invalid OTP';
        this.otpValidated = false;
      }
    });
  }

  /** Submit form */
  onSubmit(): void {
    if (!this.otpValidated) {
      this.errorMessage = 'Please verify OTP first';
      return;
    }

    if (this.userForm.invalid) {
      this.errorMessage = 'Please fill all required fields correctly.';
      this.userForm.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.userForm.getRawValue(),
      email: this.verifiedEmail,
      departmentIds: this.selectedDepartments
    };

    this.isSubmitting = true;
    this.userApiService.createUser(payload).subscribe({
      next: () => {
        this.successMessage = '✅ User created successfully!';
        this.userForm.reset();
        this.selectedDepartments = [];
        this.otpSent = false;
        this.otpValidated = false;
        this.otpInput = '';
        this.verifiedEmail = null;
        this.isSubmitting = false;
        this.authApiService.goToDashboard();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Failed to create user.';
      }
    });
  }

  cancel(): void {
   this.authApiService.goToDashboard();
  }
}
