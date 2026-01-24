import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { Department } from '../../../Model/department';
import { AuthApiService } from '../../../Services/auth-api-service';

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './edit-user.html',
  styleUrls: ['./edit-user.css'],
})
export class EditUser implements OnInit , OnDestroy {
  /** Form */
  editForm!: FormGroup;
  /** Current user info */
  currentUserRole: string| null = null;
  isCurrentUserAdmin: boolean = false;
  
  /** UI state */
  isSubmitting = false;
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  /** Data */
  userId!: number;
  originalRole = '';
  roles = ['HOD', 'TEACHER'];
  departments: Department[] = [];
  selectedDepartments: number[] = [];

  /** Password toggle */
  showPassword = false;
  passwordStrength = { score: 0, label: '', color: '' };

  /** Search departments */
  searchQuery = '';

  /** Subscriptions */
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private userApi: UserApiService,
    private deptApi: DepartmentApiService,
    private authService: AuthApiService
  ) {}

  /* --------------------------------------------------------------- */
  /* Lifecycle                                                       */
  /* --------------------------------------------------------------- */
  ngOnInit(): void {
    // Get current user info
    this.currentUserRole = this.authService.getCurrentRole();
    this.isCurrentUserAdmin = this.currentUserRole === 'ADMIN';

    this.userId = +this.route.snapshot.paramMap.get('id')!;
    this.initForm();
    this.loadDepartments();
    this.loadUser();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initForm(): void {
    this.editForm = this.fb.group({
      fullName: [
        '',
        [Validators.required, Validators.pattern(/^[a-zA-Z ]{3,}$/)],
      ],
      username: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[a-zA-Z][a-zA-Z0-9_]{3,19}$/),
        ],
      ],
      password: [
        '',
        [
          Validators.pattern(
            /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/
          ),
        ],
      ],
      role: [{ value: '', disabled: !this.isCurrentUserAdmin }, Validators.required],
      departmentIds: [[], Validators.required],
    });

    // Password strength calculation
    const pwdSub = this.editForm
      .get('password')
      ?.valueChanges.subscribe((v) =>
        this.passwordStrength = this.evaluatePasswordStrength(v || '')
      );
    if (pwdSub) this.subscriptions.push(pwdSub);

    // Role change listener
    const roleSub = this.editForm.get('role')?.valueChanges.subscribe((role) => {
      this.updateDepartmentSelectionBasedOnRole(role);
    });
    if (roleSub) this.subscriptions.push(roleSub);
  }

  /* --------------------------------------------------------------- */
  /* API calls                                                       */
  /* --------------------------------------------------------------- */
  private loadDepartments(): void {
    this.isLoading = true;
    this.deptApi.getAllDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load departments. Please try again.';
      },
    });
  }

  private loadUser(): void {
    this.isLoading = true;
    this.userApi.getUserById(this.userId).subscribe({
      next: (user) => {
        this.originalRole = user.role;
        
        const deptIds: number[] = Array.isArray(user.departmentIds)
          ? user.departmentIds
          : [];

        // Enable role field if current user is admin
        if (this.isCurrentUserAdmin) {
          this.editForm.get('role')?.enable();
        }

        this.editForm.patchValue({
          fullName: user.fullName,
          username: user.username,
          password: '',
          role: user.role,
          departmentIds: deptIds,
        });

        this.selectedDepartments = deptIds;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load user data.';
      },
    });
  }

  /* --------------------------------------------------------------- */
  /* Helpers                                                         */
  /* --------------------------------------------------------------- */
  get f() {
    return this.editForm.controls;
  }

  filteredDepartments(): Department[] {
    if (!this.searchQuery.trim()) return this.departments;
    const q = this.searchQuery.toLowerCase();
    return this.departments.filter((d) => d.name.toLowerCase().includes(q));
  }

  isDepartmentSelected(deptId: number): boolean {
    return this.selectedDepartments.includes(deptId);
  }

  updateDepartmentSelectionBasedOnRole(role: string): void {
    if (role === 'ADMIN') {
      // Admin can only have Administration department
      const adminDept = this.departments.find(
        d => d.name.toLowerCase() === 'administration'
      );
      this.selectedDepartments = adminDept ? [adminDept.departmentId] : [];
    } else if (role === 'HOD') {
      // HOD can have only one department
      if (this.selectedDepartments.length > 1) {
        this.selectedDepartments = [this.selectedDepartments[0]];
      }
    }
    // TEACHER can have multiple departments - no auto adjustment
    this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);
  }

  updateDepartmentSelection(event: Event, deptId: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    const role = this.editForm.get('role')?.value || this.originalRole;

    if (role === 'ADMIN') {
      // Admin can only select Administration department
      const adminDept = this.departments.find(
        d => d.name.toLowerCase() === 'administration'
      );
      this.selectedDepartments = adminDept ? [adminDept.departmentId] : [];
    } else if (role === 'HOD') {
      // HOD can select only one department
      if (checked) {
        this.selectedDepartments = [deptId];
      } else {
        this.selectedDepartments = [];
      }
    } else {
      // TEACHER - multi-select
      if (checked && !this.selectedDepartments.includes(deptId)) {
        this.selectedDepartments.push(deptId);
      } else if (!checked) {
        this.selectedDepartments = this.selectedDepartments.filter(
          id => id !== deptId
        );
      }
    }

    this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);
    this.editForm.get('departmentIds')?.markAsTouched();
  }

  isDeptDisabled(dept: Department): boolean {
    const role = this.editForm.get('role')?.value || this.originalRole;
    
    if (role === 'ADMIN') {
      // Admin can only be in Administration department
      return dept.name.toLowerCase() !== 'administration';
    }
    
    if (role === 'HOD') {
      // HOD can only select one department
      return this.selectedDepartments.length >= 1 && 
             !this.selectedDepartments.includes(dept.departmentId);
    }
    
    return false;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  evaluatePasswordStrength(pwd: string) {
    if (!pwd) return { score: 0, label: 'None', color: '#6c757d' };
    
    let score = 0;
    if (pwd.length >= 8) score += 20;
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[a-z]/.test(pwd)) score += 20;
    if (/\d/.test(pwd)) score += 20;
    if (/[@$!%*#?&]/.test(pwd)) score += 20;

    if (score <= 40) return { score: score, label: 'Weak', color: '#e74a3b' };
    if (score <= 80) return { score: score, label: 'Medium', color: '#f6c23e' };
    return { score: score, label: 'Strong', color: '#1cc88a' };
  }

  /* --------------------------------------------------------------- */
  /* Submit                                                          */
  /* --------------------------------------------------------------- */
  onSubmit(): void {
    this.successMessage = null;
    this.errorMessage = null;

    // Mark all fields as touched to trigger validation messages
    this.editForm.markAllAsTouched();

    if (this.editForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form before submitting.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const formValue = this.editForm.getRawValue();
    
    // Prepare payload
    const payload: any = {
      fullName: formValue.fullName.trim(),
      username: formValue.username.trim(),
      role: formValue.role,
      departmentIds: this.selectedDepartments
    };

    // Only include password if provided
    if (formValue.password && formValue.password.trim()) {
      payload.password = formValue.password.trim();
    }

    this.isSubmitting = true;
    this.userApi.updateUser(this.userId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.successMessage = 'User updated successfully!';
        
        // Show success message for 2 seconds then redirect
        setTimeout(() => {
          this.router.navigate(['/viewAllUsers']);
        }, 2000);
      },
      error: (err) => {
        this.isSubmitting = false;
        
        if (err.status === 409) {
          this.errorMessage = 'Username already exists. Please choose a different username.';
        } else if (err.status === 403) {
          this.errorMessage = 'You do not have permission to perform this action.';
        } else {
          this.errorMessage = err.error?.message || 'Failed to update user. Please try again.';
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  }

  cancel(): void {
    if (this.editForm.dirty && !confirm('Are you sure? Any unsaved changes will be lost.')) {
      return;
    }
    this.router.navigate(['/viewAllUsers']);
  }
}