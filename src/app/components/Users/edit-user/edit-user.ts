import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener } from '@angular/core';
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
import { SubjectApiService } from '../../../Services/subject-api.service';
import { SubjectDto } from '../../../Model/subject';

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
  @Input() preselectedDepartmentId?: number;
  @Input() preselectedSubDepartmentId?: string;
  @Input() lockContext = false;
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
  allSubjects: SubjectDto[] = [];
  subjectSearchQuery = '';
  showSubjectDropdown = false;
  activeItemIndex = -1;

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
    private authService: AuthApiService,
    private subjectApi: SubjectApiService
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
    const initialDeptIds = this.preselectedDepartmentId ? [this.preselectedDepartmentId] : [];
    const initialSubDeptId = this.preselectedSubDepartmentId ? this.preselectedSubDepartmentId : null;
    const initialSubDeptIds = this.preselectedSubDepartmentId ? [this.preselectedSubDepartmentId] : [];

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
      departmentIds: [initialDeptIds, Validators.required],
      parentUserId: [null],
      reportingManagerIds: [[]],
      subDepartmentId: [initialSubDeptId],
      subDepartmentIds: [initialSubDeptIds],
      subjectIds: [[]]
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

      const parentControl = this.editForm.get('reportingManagerIds');
      if (role && role !== 'SUPER_ADMIN') {
        parentControl?.setValidators([Validators.required, Validators.minLength(1)]);
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

      const subDeptControl = this.editForm.get('subDepartmentId');
      const subDeptsControl = this.editForm.get('subDepartmentIds');
      if (role === 'HOD' || role === 'TEACHER') {
        subDeptControl?.setValidators([Validators.required]);
        subDeptsControl?.setValidators([Validators.required]);
      } else {
        subDeptControl?.clearValidators();
        subDeptControl?.setValue(null);
        subDeptsControl?.clearValidators();
        subDeptsControl?.setValue([]);
      }
      subDeptControl?.updateValueAndValidity();
      subDeptsControl?.updateValueAndValidity();
    });
    if (roleSub) this.subscriptions.push(roleSub);

    // SubDepartment change listener to reload subjects
    const subDeptSub = this.editForm.get('subDepartmentId')?.valueChanges.subscribe((subDeptId) => {
      this.onSubDepartmentChange(subDeptId);
    });
    if (subDeptSub) this.subscriptions.push(subDeptSub);

    const subDeptsSub = this.editForm.get('subDepartmentIds')?.valueChanges.subscribe(() => {
      this.reloadSubjects();
    });
    if (subDeptsSub) this.subscriptions.push(subDeptsSub);
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
    if (selectedRole && selectedRole !== 'SUPER_ADMIN') {
      this.userApi.getEligibleManagers(selectedRole).subscribe({
        next: (managers) => {
          this.filteredParentUsers = managers.filter(u => u.userId !== this.userId);
        },
        error: (err) => console.error('Failed to load eligible managers for role ' + selectedRole, err)
      });
    }
  }

  onSubDepartmentChange(subDeptId: string | null): void {
    this.reloadSubjects();
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

        const managerIds = user.reportingManagerIds || (user.parentUserId ? [user.parentUserId] : []);
        this.editForm.patchValue({
          fullName: user.fullName,
          username: user.username,
          password: '',
          role: user.role,
          departmentIds: deptIds,
          parentUserId: user.parentUserId || null,
          reportingManagerIds: managerIds,
          subDepartmentId: user.subDepartmentId || null,
          subDepartmentIds: user.subDepartmentIds || [],
          subjectIds: user.subjectIds || []
        });

        this.selectedDepartments = deptIds;
        this.onDepartmentChange();
        this.onRoleChange(user.role);
        this.reloadSubjects();
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
    if (role === 'HOD' || role === 'SUB_ADMIN') {
      if (this.selectedDepartments.length > 1) {
        this.selectedDepartments = [this.selectedDepartments[0]];
      }
    }
    this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);
    this.onDepartmentChange();
    this.reloadSubjects();
  }

  updateDepartmentSelection(event: Event, deptId: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    const role = this.editForm.get('role')?.value || this.originalRole;

    if (role === 'HOD' || role === 'SUB_ADMIN') {
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
    this.reloadSubjects();
  }

  isDeptDisabled(dept: Department): boolean {
    const role = this.editForm.get('role')?.value || this.originalRole;
    
    if (role === 'HOD' || role === 'SUB_ADMIN') {
      // HOD and SUB_ADMIN can only select one department
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

    // Mark all fields touched to show inline validation errors
    this.editForm.markAllAsTouched();
    this.editForm.markAsDirty();

    if (this.editForm.invalid) {
      // Build specific validation messages
      const errors: string[] = [];

      if (this.f['fullName'].errors?.['required']) errors.push('Full name is required.');
      else if (this.f['fullName'].errors?.['pattern']) errors.push('Full name must contain only letters and spaces (min 3 characters).');

      if (this.f['username'].errors?.['required']) errors.push('Username is required.');
      else if (this.f['username'].errors?.['pattern']) errors.push('Username must start with a letter, 4–20 alphanumeric characters or underscores.');

      if (this.f['password'].value && this.f['password'].errors?.['pattern'])
        errors.push('Password must include uppercase, lowercase, number, special character and be at least 8 characters.');

      if (this.f['role'].errors?.['required']) errors.push('System role must be selected.');

      if (this.editForm.get('reportingManagerIds')?.errors?.['required'] ||
          this.editForm.get('reportingManagerIds')?.errors?.['minlength'])
        errors.push('At least one reporting manager must be selected.');

      if (this.f['departmentIds'].errors?.['required']) errors.push('At least one department must be selected.');

      if (this.f['subDepartmentIds']?.errors?.['required']) errors.push('Sub-department is required for HOD and Teacher roles.');

      if (errors.length > 0) {
        this.errorMessage = errors.join(' • ');
      } else {
        this.errorMessage = 'Please correct the highlighted fields before submitting.';
      }

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
      reportingManagerIds: formValue.reportingManagerIds || [],
      subDepartmentId: formValue.subDepartmentId,
      subDepartmentIds: formValue.subDepartmentIds || [],
      subjectIds: formValue.subjectIds || []
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

  // ===========================================================
  // Searchable Multiselect Helpers
  // ===========================================================
  reloadSubjects(): void {
    const selectedDeptIds = this.selectedDepartments || [];
    const subDeptId = this.editForm.get('subDepartmentId')?.value;

    if (selectedDeptIds.length === 0 && !subDeptId) {
      this.allSubjects = [];
      this.editForm.get('subjectIds')?.setValue([]);
      return;
    }

    if (subDeptId) {
      this.subjectApi.getSubjects(null, subDeptId).subscribe({
        next: (subs) => {
          this.allSubjects = subs;
          this.validateSelectedSubjects();
        },
        error: (err) => console.error('Failed to load subjects', err)
      });
    } else if (selectedDeptIds.length > 0) {
      const requests = selectedDeptIds.map(id => this.subjectApi.getSubjects(id, null));
      forkJoin(requests).subscribe({
        next: (results) => {
          const merged = results.flat();
          const unique = merged.filter((sub, index, self) =>
            index === self.findIndex((t) => t.id === sub.id)
          );
          this.allSubjects = unique;
          this.validateSelectedSubjects();
        },
        error: (err) => console.error('Failed to load subjects for departments', err)
      });
    }
  }

  validateSelectedSubjects(): void {
    const currentSelected: number[] = this.editForm.get('subjectIds')?.value || [];
    const validSelected = currentSelected.filter(id =>
      this.allSubjects.some(sub => sub.id === id)
    );
    this.editForm.get('subjectIds')?.setValue(validSelected);
  }

  isSubjectSelected(id: number): boolean {
    const selected = this.editForm.get('subjectIds')?.value || [];
    return selected.includes(id);
  }

  getSelectedSubjectIds(): number[] {
    return this.editForm.get('subjectIds')?.value || [];
  }

  getSubjectName(id: number): string {
    const sub = this.allSubjects.find(s => s.id === id);
    return sub ? sub.subjectName : `Subject #${id}`;
  }

  filteredSubjectsList(): any[] {
    const q = this.subjectSearchQuery.toLowerCase().trim();
    if (!q) return this.allSubjects;
    return this.allSubjects.filter(sub =>
      sub.subjectName.toLowerCase().includes(q) ||
      (sub.subjectCode && sub.subjectCode.toLowerCase().includes(q))
    );
  }

  toggleSubjectSelection(id: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const control = this.editForm.get('subjectIds');
    const current: number[] = control?.value || [];
    let updated: number[];

    if (current.includes(id)) {
      updated = current.filter(x => x !== id);
    } else {
      updated = [...current, id];
      // Auto Assignment Logic:
      const subjectObj = this.allSubjects.find(s => s.id === id);
      if (subjectObj) {
        if (!this.selectedDepartments.includes(subjectObj.departmentId)) {
          this.selectedDepartments = [...this.selectedDepartments, subjectObj.departmentId];
          this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);
          this.onDepartmentChange();
        }
        if (subjectObj.subDepartmentId && !this.editForm.get('subDepartmentId')?.value) {
          this.editForm.get('subDepartmentId')?.setValue(subjectObj.subDepartmentId);
        }
      }
    }
    control?.setValue(updated);
    control?.markAsTouched();
    control?.markAsDirty();
  }

  removeSubject(id: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.editForm.get('subjectIds');
    const current: number[] = control?.value || [];
    control?.setValue(current.filter(x => x !== id));
    control?.markAsTouched();
    control?.markAsDirty();
  }

  focusSearchInput(event: Event): void {
    if ((event.target as HTMLElement).tagName !== 'BUTTON') {
      const inputEl = document.querySelector('input[placeholder="🔍 Search Subject..."]') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
      }
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showSubjectDropdown = false;
      this.activeItemIndex = -1;
    }, 250);
  }

  handleMultiselectKeydown(event: KeyboardEvent): void {
    const list = this.filteredSubjectsList();
    if (!this.showSubjectDropdown) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.showSubjectDropdown = true;
        this.activeItemIndex = 0;
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      this.activeItemIndex = (this.activeItemIndex + 1) % list.length;
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.activeItemIndex = (this.activeItemIndex - 1 + list.length) % list.length;
      event.preventDefault();
    } else if (event.key === 'Enter') {
      if (this.activeItemIndex >= 0 && this.activeItemIndex < list.length) {
        this.toggleSubjectSelection(list[this.activeItemIndex].id);
        event.preventDefault();
      }
    } else if (event.key === 'Escape') {
      this.showSubjectDropdown = false;
      this.activeItemIndex = -1;
      event.preventDefault();
    }
  }

  showSubDeptDropdown = false;

  getSelectedSubDeptIds(): string[] {
    return this.editForm.get('subDepartmentIds')?.value || [];
  }

  getSubDeptName(id: string): string {
    const sub = this.subDepartments.find(s => s.id === id);
    return sub ? sub.name : 'Sub-Dept';
  }

  isSubDeptSelected(id: string): boolean {
    return this.getSelectedSubDeptIds().includes(id);
  }

  toggleSubDeptSelection(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.editForm.get('subDepartmentIds');
    const current: string[] = control?.value || [];
    let updated: string[];
    if (current.includes(id)) {
      updated = current.filter(x => x !== id);
    } else {
      updated = [...current, id];
    }
    control?.setValue(updated);
    this.editForm.get('subDepartmentId')?.setValue(updated.length > 0 ? updated[0] : null);
    control?.markAsTouched();
    this.reloadSubjects();
  }

  removeSubDept(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.editForm.get('subDepartmentIds');
    const current: string[] = control?.value || [];
    const updated = current.filter(x => x !== id);
    control?.setValue(updated);
    this.editForm.get('subDepartmentId')?.setValue(updated.length > 0 ? updated[0] : null);
    control?.markAsTouched();
    this.reloadSubjects();
  }

  showManagerDropdown = false;
  managerSearchQuery = '';

  getSelectedManagerIds(): number[] {
    return this.editForm.get('reportingManagerIds')?.value || [];
  }

  getManagerName(id: number): string {
    const mgr = this.filteredParentUsers.find(u => u.userId === id);
    return mgr ? mgr.fullName : `User #${id}`;
  }

  isManagerSelected(id: number): boolean {
    return this.getSelectedManagerIds().includes(id);
  }

  toggleManagerSelection(id: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const control = this.editForm.get('reportingManagerIds');
    const current: number[] = control?.value || [];
    let updated: number[];
    if (current.includes(id)) {
      updated = current.filter(x => x !== id);
    } else {
      updated = [...current, id];
    }
    control?.setValue(updated);
    control?.markAsTouched();
    control?.markAsDirty();

    // Set first manager as parentUserId for backward compatibility
    this.editForm.get('parentUserId')?.setValue(updated.length > 0 ? updated[0] : null);
  }

  removeManager(id: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.editForm.get('reportingManagerIds');
    const current: number[] = control?.value || [];
    const updated = current.filter(x => x !== id);
    control?.setValue(updated);
    control?.markAsTouched();
    control?.markAsDirty();

    this.editForm.get('parentUserId')?.setValue(updated.length > 0 ? updated[0] : null);
  }

  filteredManagersList(): any[] {
    const q = this.managerSearchQuery.toLowerCase().trim();
    if (!q) return this.filteredParentUsers;
    return this.filteredParentUsers.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-multiselect-container')) {
      this.showSubDeptDropdown = false;
      this.showSubjectDropdown = false;
      this.showManagerDropdown = false;
    }
  }
}