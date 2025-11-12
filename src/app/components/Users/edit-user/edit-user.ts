import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { Department } from '../../../Model/department';

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './edit-user.html',
  styleUrls: ['./edit-user.css'],
})
export class EditUser implements OnInit {
  /** Form */
  editForm!: FormGroup;
isRoleEditable = false; // or true based on logic
  /** UI state */
  isSubmitting = false;
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  /** Data */
  userId!: number;
  originalRole = '';
  roles = ['ADMIN', 'HOD', 'TEACHER'];
  departments: Department[] = [];
  selectedDepartments: number[] = [];

  /** Password toggle */
  showPassword = false;
  passwordStrength = { score: 0, label: '', color: '' };

  /** Search departments (optional – kept for consistency) */
  searchQuery = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private userApi: UserApiService,
    private deptApi: DepartmentApiService
  ) {}

  /* --------------------------------------------------------------- */
  /* Lifecycle                                                       */
  /* --------------------------------------------------------------- */
  ngOnInit(): void {
    this.userId = +this.route.snapshot.paramMap.get('id')!;
    this.initForm();
    this.loadDepartments();
    this.loadUser();
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
        // optional – only validate when something is entered
        [
          Validators.pattern(
            /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/
          ),
        ],
      ],
      role: [{ value: '', disabled: true }, Validators.required],
      departmentIds: [[], Validators.required],
    });

    // password strength bar (only when user types)
    this.editForm
      .get('password')
      ?.valueChanges.subscribe((v) =>
        this.passwordStrength = this.evaluatePasswordStrength(v || '')
      );
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
        this.errorMessage = 'Failed to load departments';
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

        this.editForm.patchValue({
          fullName: user.fullName,
          username: user.username,
          password: '',               // never show real password
          role: user.role,
          departmentIds: deptIds,
        });

        this.selectedDepartments = deptIds;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to load user';
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

  /** Department selection logic – identical to Add-User */
  updateDepartmentSelection(event: Event, deptId: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    const role = this.originalRole;

    if (role === 'ADMIN') {
      const admin = this.departments.find(
        (d) => d.name.toLowerCase() === 'administration'
      );
      this.selectedDepartments = admin ? [admin.departmentId] : [];
    } else if (role === 'HOD') {
      this.selectedDepartments = checked ? [deptId] : [];
    } else {
      // TEACHER – multi-select
      if (checked && !this.selectedDepartments.includes(deptId)) {
        this.selectedDepartments.push(deptId);
      } else if (!checked) {
        this.selectedDepartments = this.selectedDepartments.filter(
          (id) => id !== deptId
        );
      }
    }

    this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);
  }

  isDeptDisabled(dept: Department): boolean {
    const role = this.originalRole;
    if (role === 'ADMIN' && dept.name.toLowerCase() !== 'administration')
      return true;
    if (
      role === 'HOD' &&
      this.selectedDepartments.length >= 1 &&
      !this.selectedDepartments.includes(dept.departmentId)
    )
      return true;
    return false;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  evaluatePasswordStrength(pwd: string) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[@$!%*#?&]/.test(pwd)) score++;

    if (score <= 2) return { score: 20, label: 'Weak', color: '#e74a3b' };
    if (score <= 4) return { score: 60, label: 'Medium', color: '#f6c23e' };
    return { score: 100, label: 'Strong', color: '#1cc88a' };
  }

  /* --------------------------------------------------------------- */
  /* Submit                                                          */
  /* --------------------------------------------------------------- */
  onSubmit(): void {
    this.successMessage = null;
    this.errorMessage = null;

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.errorMessage = 'Please correct the errors in the form.';
      return;
    }

    const raw = this.editForm.getRawValue();

    // If password is empty → send null so backend keeps the old one
    const payload = {
      fullName: raw.fullName,
      username: raw.username,
      password: raw.password || null,
      role: this.originalRole,
      departmentIds: this.selectedDepartments,
    };

    this.isSubmitting = true;
    this.userApi.updateUser(this.userId, payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'User updated successfully!';
        setTimeout(() => this.router.navigate(['/viewAllUsers']), 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage =
          err.error?.message || 'Failed to update the user.';
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/viewAllUsers']);
  }
}