import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
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
export class EditUser implements OnInit, OnDestroy, OnChanges {
  @Input() userId!: number;
  @Input() isModal = false;
  @Output() closed = new EventEmitter<boolean>();
  /** Form */
  editForm!: FormGroup;
  /** Current user info */
  currentUserRole: string | null = null;
  isCurrentUserAdmin: boolean = false;

  /** UI state */
  isSubmitting = false;
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  /** Data */
  originalRole = '';
  roles: string[] = [];
  departments: Department[] = [];
  selectedDepartments: number[] = [];

  // Hierarchy additions
  allUsers: any[] = [];
  filteredParentUsers: any[] = [];
  subDepartments: any[] = [];

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

  ngOnInit(): void {
    // Get current user info
    this.currentUserRole = this.authService.getCurrentRole();
    this.isCurrentUserAdmin = this.currentUserRole === 'ADMIN' || this.currentUserRole === 'SUPER_ADMIN';

    if (!this.userId) {
      this.userId = +this.route.snapshot.paramMap.get('id')!;
    }
    this.initForm();
    this.loadDepartments();
    this.loadAllUsers();
    this.loadUser();

    // Set dynamic roles list based on logged-in user role
    const currentRole = this.authService.getCurrentRole() || '';
    const allRolesList = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HOD', 'TEACHER'];
    const currentIdx = allRolesList.indexOf(currentRole);
    this.roles = currentIdx !== -1 ? allRolesList.slice(currentIdx + 1) : ['HOD', 'TEACHER'];
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && !changes['userId'].firstChange) {
      this.loadUser();
    }
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
      parentUserId: [null],
      subDepartmentId: [null]
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
      this.onRoleChange(role);

      const parentControl = this.editForm.get('parentUserId');
      if (role && role !== 'SUPER_ADMIN') {
        parentControl?.setValidators([Validators.required]);
      } else {
        parentControl?.clearValidators();
      }
      parentControl?.updateValueAndValidity();

      const deptControl = this.editForm.get('departmentIds');
      if (role === 'SUPER_ADMIN') {
        deptControl?.clearValidators();
        deptControl?.setValue([]);
      } else {
        deptControl?.setValidators([Validators.required]);
      }
      deptControl?.updateValueAndValidity();
    });
    if (roleSub) this.subscriptions.push(roleSub);
  }

  private loadAllUsers(): void {
    this.userApi.getAllUsers().subscribe({
      next: (users) => {
        this.allUsers = users;
        if (this.editForm.get('role')?.value) {
          this.onRoleChange(this.editForm.get('role')?.value);
        }
      },
      error: (err) => console.error('Failed to load users for parent selection', err)
    });
  }

  onRoleChange(selectedRole: string): void {
    this.filteredParentUsers = [];
    if (selectedRole === 'TEACHER') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'HOD' && u.userId !== this.userId);
    } else if (selectedRole === 'HOD') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'SUB_ADMIN' && u.userId !== this.userId);
    } else if (selectedRole === 'SUB_ADMIN') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'ADMIN' && u.userId !== this.userId);
    } else if (selectedRole === 'ADMIN') {
      this.filteredParentUsers = this.allUsers.filter(u => (u.role || '').toUpperCase() === 'SUPER_ADMIN' && u.userId !== this.userId);
    }
  }

  onDepartmentChange(): void {
    this.subDepartments = [];
    if (this.selectedDepartments && this.selectedDepartments.length > 0) {
      const requests = this.selectedDepartments.map(id => this.deptApi.getSubDepartmentsByDepartment(id));
      forkJoin(requests).subscribe({
        next: (results) => {
          this.subDepartments = results.flat();
        },
        error: (err) => console.error('Failed to load sub-departments', err)
      });
    }
  }

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
          parentUserId: user.parentUserId || null,
          subDepartmentId: user.subDepartmentId || null
        });

        this.selectedDepartments = deptIds;
        this.onDepartmentChange();
        this.onRoleChange(user.role);
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
      const adminDept = this.departments.find(
        d => d.name.toLowerCase() === 'administration'
      );
      this.selectedDepartments = adminDept ? [adminDept.departmentId] : [];
    } else if (role === 'HOD') {
      if (this.selectedDepartments.length > 1) {
        this.selectedDepartments = [this.selectedDepartments[0]];
      }
    }
    this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);
    this.onDepartmentChange();
  }

  updateDepartmentSelection(event: Event, deptId: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    const role = this.editForm.get('role')?.value || this.originalRole;

    if (role === 'ADMIN') {
      const adminDept = this.departments.find(
        d => d.name.toLowerCase() === 'administration'
      );
      this.selectedDepartments = adminDept ? [adminDept.departmentId] : [];
    } else if (role === 'HOD') {
      if (checked) {
        this.selectedDepartments = [deptId];
      } else {
        this.selectedDepartments = [];
      }
    } else {
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
    this.onDepartmentChange();
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
      departmentIds: this.selectedDepartments,
      parentUserId: formValue.parentUserId,
      subDepartmentId: formValue.subDepartmentId
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
        
        // Show success message for 2 seconds then redirect/close
        setTimeout(() => {
          if (this.isModal) {
            this.closed.emit(true);
          } else {
            this.router.navigate(['/viewAllUsers']);
          }
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
    if (this.isModal) {
      this.closed.emit(false);
    } else {
      this.router.navigate(['/viewAllUsers']);
    }
  }
}