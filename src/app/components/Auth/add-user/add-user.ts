import { CommonModule } from '@angular/common';
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './add-user.html',
  styleUrls: ['./add-user.css']
})
export class AddUserComponent implements OnInit {
  @Input() isModal = false;
  @Output() closed = new EventEmitter<boolean>();

  userForm: FormGroup;
  isSubmitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  roles: string[] = [];
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
  departmentId: string | null = null;

  // Hierarchy
  allUsers: any[] = [];
  filteredParentUsers: any[] = [];
  subDepartments: any[] = [];

  constructor(
    private fb: FormBuilder,
    private departmentApiService: DepartmentApiService,
    private apiService: ApiService,
    private userApiService: UserApiService,
    private authApiService: AuthApiService,
    private route : ActivatedRoute
  ) {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64), Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!]).{8,64}$/)]],
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]{3,}$/)]],
      role: ['', Validators.required],
      departmentIds: [[], Validators.required],
      parentUserId: [null],
      subDepartmentId: [null]
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const deptIdStr = params['departmentId'];
      if (deptIdStr) {
        this.departmentId = deptIdStr;
        const deptId = +deptIdStr;
        this.selectedDepartments = [deptId];
        this.userForm.patchValue({ departmentIds: [deptId] });
        this.onDepartmentChange();
      }
    });
    console.log('Preselected Department ID:', this.departmentId);
    this.loadDepartments();
    this.loadAllUsers();

    // Set dynamic roles list based on logged-in user role
    const currentRole = this.authApiService.getCurrentRole() || '';
    const allRolesList = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HOD', 'TEACHER'];
    const currentIdx = allRolesList.indexOf(currentRole);
    this.roles = currentIdx !== -1 ? allRolesList.slice(currentIdx + 1) : ['HOD', 'TEACHER'];

    this.userForm.get('password')?.valueChanges.subscribe(value => {
      this.passwordStrength = this.evaluatePasswordStrength(value || '');
    });

    this.userForm.get('role')?.valueChanges.subscribe(role => {
      this.onRoleChange(role);
      const parentControl = this.userForm.get('parentUserId');
      if (role && role !== 'SUPER_ADMIN') {
        parentControl?.setValidators([Validators.required]);
      } else {
        parentControl?.clearValidators();
      }
      parentControl?.updateValueAndValidity();

      const deptControl = this.userForm.get('departmentIds');
      if (role === 'SUPER_ADMIN') {
        deptControl?.clearValidators();
        deptControl?.setValue([]);
      } else {
        deptControl?.setValidators([Validators.required]);
      }
      deptControl?.updateValueAndValidity();

      const subDeptControl = this.userForm.get('subDepartmentId');
      if (role === 'HOD' || role === 'TEACHER') {
        subDeptControl?.setValidators([Validators.required]);
      } else {
        subDeptControl?.clearValidators();
        subDeptControl?.setValue(null);
      }
      subDeptControl?.updateValueAndValidity();
    });
  }

  loadAllUsers(): void {
    this.userApiService.getAllUsers().subscribe({
      next: (users) => {
        this.allUsers = users;
      },
      error: (err) => console.error('Failed to load users for parent selection', err)
    });
  }

  onRoleChange(selectedRole: string): void {
    this.filteredParentUsers = [];
    this.userForm.get('parentUserId')?.setValue(null);

    if (selectedRole === 'TEACHER') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'HOD');
    } else if (selectedRole === 'HOD') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'SUB_ADMIN');
    } else if (selectedRole === 'SUB_ADMIN') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'ADMIN');
    } else if (selectedRole === 'ADMIN') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'SUPER_ADMIN');
    }
  }

  onDepartmentChange(): void {
    this.subDepartments = [];
    this.userForm.get('subDepartmentId')?.setValue(null);
    if (this.selectedDepartments && this.selectedDepartments.length > 0) {
      const requests = this.selectedDepartments.map(id => this.departmentApiService.getSubDepartmentsByDepartment(id));
      forkJoin(requests).subscribe({
        next: (results) => {
          this.subDepartments = results.flat();
        },
        error: (err) => console.error('Failed to load sub-departments', err)
      });
    }
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
    } else if (role === 'HOD' || role === 'SUB_ADMIN') {
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
    this.onDepartmentChange();
  }

  isDeptDisabled(dept: any): boolean {
    const role = this.userForm.get('role')?.value;
    if (role === 'ADMIN' && dept.name.toLowerCase() !== 'administration') return true;
    if ((role === 'HOD' || role === 'SUB_ADMIN') && this.selectedDepartments.length >= 1 && !this.selectedDepartments.includes(dept.departmentId))
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
        setTimeout(() => {
          if (this.isModal) {
            this.closed.emit(true);
          } else {
            this.authApiService.goToDashboard();
          }
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Failed to create user.';
      }
    });
  }

  cancel(): void {
    if (this.isModal) {
      this.closed.emit(false);
    } else {
      this.authApiService.goToDashboard();
    }
  }
}
