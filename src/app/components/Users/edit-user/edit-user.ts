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
import { UserRoleAssignmentDTO, ScopedRoleAssignment } from '../../../Model/user-role-assignment-dto';

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
  @Input() isCreateMode = false;
  @Input() preselectedDepartmentId?: number;
  @Input() preselectedSubDepartmentId?: string;
  @Input() lockContext = false;
  @Output() closed = new EventEmitter<boolean>();

  get isEdit(): boolean {
    return !this.isCreateMode && !!this.userId && this.userId > 0;
  }
  /**
   * TEMPORARY TOGGLE: Allow promoting a user to SUPER_ADMIN.
   * - Set to `true` to enable selecting 'SUPER_ADMIN' when logged in as SUPER_ADMIN.
   * - Set back to `false` to revert/disable this option after updating the user.
   */
  readonly ALLOW_SUPER_ADMIN_OPTION: boolean = false;

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
  primaryRole: string | null = null;
  existingAssignments: UserRoleAssignmentDTO[] = [];
  roles: string[] = [];
  departments: Department[] = [];
  selectedDepartments: number[] = [];

  // Scoped Role Assignments (Multi-Role System)
  scopedAssignments: ScopedRoleAssignment[] = [];
  newAssignmentDeptId: number | null = null;
  newAssignmentSubDeptId: string | null = null;
  newAssignmentRole: 'HOD' | 'TEACHER' = 'TEACHER';
  availableSubDeptsForNewAssignment: any[] = [];
  assignmentError: string | null = null;
  legacyConflictDetected: boolean = false;
  legacyConflictMessage: string = '';

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
  ) { }

  ngOnInit(): void {
    // Get current user info
    this.currentUserRole = this.authService.getCurrentRole();
    this.isCurrentUserAdmin = this.currentUserRole === 'ADMIN' || this.currentUserRole === 'SUPER_ADMIN';

    if (!this.isCreateMode && (!this.userId || this.userId === 0)) {
      const routeId = this.route.snapshot.paramMap.get('id');
      if (routeId) {
        this.userId = +routeId;
      }
    }
    this.initForm();
    this.loadDepartments();
    this.loadAllUsers();

    if (this.isEdit) {
      this.loadUser();
    } else {
      this.isLoading = false;
      this.setupCreateModeDefaults();
    }

    // Set dynamic roles list based on logged-in user role
    const currentRole = this.authService.getCurrentRole() || '';
    const allRolesList = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HOD', 'TEACHER'];
    const currentIdx = allRolesList.indexOf(currentRole);

    if (currentRole === 'SUPER_ADMIN' && this.ALLOW_SUPER_ADMIN_OPTION) {
      this.roles = allRolesList;
    } else {
      this.roles = currentIdx !== -1 ? allRolesList.slice(currentIdx + 1) : ['HOD', 'TEACHER'];
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['userId'] && !changes['userId'].firstChange) {
      if (this.isEdit) {
        this.loadUser();
      }
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
      email: [
        '',
        [Validators.required, Validators.email]
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
      parentControl?.clearValidators();
      parentControl?.updateValueAndValidity();

      const deptControl = this.editForm.get('departmentIds');
      if (role === 'SUPER_ADMIN') {
        deptControl?.clearValidators();
        deptControl?.setValue([]);
        this.selectedDepartments = [];
        this.editForm.get('parentUserId')?.setValue(null);
        this.editForm.get('reportingManagerIds')?.setValue([]);
        this.editForm.get('subDepartmentId')?.setValue(null);
        this.editForm.get('subDepartmentIds')?.setValue([]);
        this.editForm.get('subjectIds')?.setValue([]);
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
          const merged = results.flat();
          this.subDepartments = merged.filter((sub, index, self) =>
            index === self.findIndex(t => t.id === sub.id)
          );

          // Populate subDepartmentName and departmentName in scopedAssignments if missing
          for (const sa of this.scopedAssignments) {
            if (!sa.subDepartmentName) {
              const sd = this.subDepartments.find(s => s.id === sa.subDepartmentId);
              if (sd) sa.subDepartmentName = sd.name;
            }
            if (!sa.departmentName) {
              const d = this.departments.find(dept => dept.departmentId === sa.departmentId);
              if (d) sa.departmentName = d.name;
            }
          }

          if (this.scopedAssignments.length > 0) {
            const currentSubDeptIds = this.scopedAssignments.map(a => a.subDepartmentId);
            this.editForm.get('subDepartmentIds')?.setValue(currentSubDeptIds);
            this.editForm.get('subDepartmentId')?.setValue(currentSubDeptIds.length > 0 ? currentSubDeptIds[0] : null);
          } else {
            const currentSubDeptIds = this.getSelectedSubDeptIds();
            const validSubDeptIds = currentSubDeptIds.filter(id => this.subDepartments.some(s => s.id === id));
            this.editForm.get('subDepartmentIds')?.setValue(validSubDeptIds);
            this.editForm.get('subDepartmentId')?.setValue(validSubDeptIds.length > 0 ? validSubDeptIds[0] : null);
          }

          if (this.newAssignmentDeptId) {
            this.availableSubDeptsForNewAssignment = this.subDepartments.filter(
              s => (s.department?.departmentId === this.newAssignmentDeptId || s.departmentId === this.newAssignmentDeptId)
            );
          }

          this.reloadSubjects();
        },
        error: (err) => console.error('Failed to load sub-departments', err)
      });
    } else {
      this.editForm.get('subDepartmentIds')?.setValue([]);
      this.editForm.get('subDepartmentId')?.setValue(null);
      this.editForm.get('subjectIds')?.setValue([]);
      this.allSubjects = [];
    }
  }

  private loadDepartments(): void {
    this.isLoading = true;
    this.deptApi.getAuthorizedDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        this.isLoading = false;
        // Enrich any scoped assignments with department names
        for (const sa of this.scopedAssignments) {
          if (!sa.departmentName) {
            const d = this.departments.find(dept => dept.departmentId === sa.departmentId);
            if (d) sa.departmentName = d.name;
          }
        }
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Failed to load authorized departments. Please try again.';
      },
    });
  }

  private setupCreateModeDefaults(): void {
    const pwdControl = this.editForm.get('password');
    pwdControl?.setValidators([
      Validators.required,
      Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/)
    ]);
    pwdControl?.updateValueAndValidity();

    if (this.preselectedDepartmentId) {
      this.selectedDepartments = [this.preselectedDepartmentId];
      this.editForm.patchValue({ departmentIds: [this.preselectedDepartmentId] });
      this.newAssignmentDeptId = this.preselectedDepartmentId;
      this.onDepartmentChange();
    }
    if (this.preselectedSubDepartmentId) {
      this.editForm.patchValue({
        subDepartmentId: this.preselectedSubDepartmentId,
        subDepartmentIds: [this.preselectedSubDepartmentId]
      });
      this.newAssignmentSubDeptId = this.preselectedSubDepartmentId;
      this.reloadSubjects();
    }
    if (this.isCurrentUserAdmin) {
      this.editForm.get('role')?.enable();
    }
  }

  private loadUser(): void {
    this.isLoading = true;
    this.userApi.getUserById(this.userId).subscribe({
      next: (user) => {
        this.originalRole = user.role;
        this.primaryRole = user.primaryRole || user.role;
        this.existingAssignments = user.roleAssignments || [];

        const deptIds: number[] = Array.isArray(user.departmentIds)
          ? user.departmentIds
          : [];

        // Helper to check if assignment is active (handles both 'active' and 'isActive' boolean properties)
        const isAssignmentActive = (a: any) => {
          if (a.active !== undefined) return Boolean(a.active);
          if (a.isActive !== undefined) return Boolean(a.isActive);
          return true;
        };

        // Parse scoped role assignments and detect conflicts
        const activeSubDeptAssignments = (user.roleAssignments || []).filter(
          a => isAssignmentActive(a) && Boolean(a.subDepartmentId)
        );
        const map = new Map<string, ScopedRoleAssignment>();
        const conflicts: string[] = [];

        for (const a of activeSubDeptAssignments) {
          const subId = a.subDepartmentId!;
          const rawRole = (a.roleName || (a as any).role || '').toString().trim().toUpperCase();
          const roleName: 'HOD' | 'TEACHER' = rawRole === 'HOD' ? 'HOD' : 'TEACHER';

          if (map.has(subId)) {
            const existing = map.get(subId)!;
            conflicts.push(`${a.subDepartmentName || subId} (${existing.role} & ${roleName})`);
            if (roleName === 'HOD') {
              map.set(subId, {
                id: a.id,
                departmentId: a.departmentId || existing.departmentId,
                departmentName: a.departmentName || existing.departmentName,
                subDepartmentId: subId,
                subDepartmentName: a.subDepartmentName || existing.subDepartmentName,
                role: 'HOD'
              });
            }
          } else {
            map.set(subId, {
              id: a.id,
              departmentId: a.departmentId || (deptIds.length > 0 ? deptIds[0] : 0),
              departmentName: a.departmentName || '',
              subDepartmentId: subId,
              subDepartmentName: a.subDepartmentName || '',
              role: roleName
            });
          }
        }

        if (conflicts.length > 0) {
          this.legacyConflictDetected = true;
          this.legacyConflictMessage = `Multiple active roles were found for: ${conflicts.join(', ')}. Automatically resolved to the higher role. You may adjust or save.`;
        } else {
          this.legacyConflictDetected = false;
          this.legacyConflictMessage = '';
        }

        this.scopedAssignments = Array.from(map.values());

        // Fallback ONLY for legacy users who had subDepartmentIds with zero roleAssignments
        if (this.scopedAssignments.length === 0 && user.subDepartmentIds && user.subDepartmentIds.length > 0) {
          const defaultRole = (user.role === 'HOD' ? 'HOD' : 'TEACHER') as 'HOD' | 'TEACHER';
          this.scopedAssignments = user.subDepartmentIds.map(sdId => ({
            departmentId: deptIds.length > 0 ? deptIds[0] : 0,
            subDepartmentId: sdId,
            role: defaultRole
          }));
        }

        this.recalculatePrimaryRole();

        // Ensure user's current role is included in the roles list so select binding works correctly
        if (user.role && !this.roles.includes(user.role)) {
          this.roles = [user.role, ...this.roles];
        }

        // Enable role field if current user is admin
        if (this.isCurrentUserAdmin) {
          this.editForm.get('role')?.enable();
        }

        const managerIds = user.reportingManagerIds || (user.parentUserId ? [user.parentUserId] : []);
        this.editForm.patchValue({
          fullName: user.fullName,
          username: user.username,
          email: user.email || '',
          password: '',
          role: this.primaryRole || user.role,
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
    if (role === 'SUB_ADMIN') {
      if (this.selectedDepartments.length > 1) {
        this.selectedDepartments = [this.selectedDepartments[0]];
      }
    } else if (role === 'SUPER_ADMIN') {
      this.selectedDepartments = [];
    }
    this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);
    this.onDepartmentChange();
    this.reloadSubjects();
  }

  updateDepartmentSelection(event: Event, deptId: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    const role = this.editForm.get('role')?.value || this.originalRole;

    if (role === 'SUB_ADMIN') {
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

    if (role === 'SUB_ADMIN') {
      return this.selectedDepartments.length >= 1 &&
        !this.selectedDepartments.includes(dept.departmentId);
    }

    return false;
  }

  /* --------------------------------------------------------------- */
  /* Scoped Role Assignments & Primary Role Helpers                  */
  /* --------------------------------------------------------------- */
  recalculatePrimaryRole(): void {
    const roleHierarchy = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HOD', 'TEACHER'];
    const currentTopRole = this.editForm?.get('role')?.value;

    if (currentTopRole === 'SUPER_ADMIN' || currentTopRole === 'ADMIN' || currentTopRole === 'SUB_ADMIN') {
      this.primaryRole = currentTopRole;
      return;
    }

    if (this.scopedAssignments && this.scopedAssignments.length > 0) {
      let highestRole = 'TEACHER';
      let highestRank = 999;
      for (const a of this.scopedAssignments) {
        const rank = roleHierarchy.indexOf(a.role);
        if (rank !== -1 && rank < highestRank) {
          highestRank = rank;
          highestRole = a.role;
        }
      }
      this.primaryRole = highestRole;
      if (this.editForm && this.editForm.get('role')?.value !== highestRole) {
        this.editForm.get('role')?.setValue(highestRole, { emitEvent: false });
      }
    } else {
      this.primaryRole = currentTopRole || this.originalRole || 'TEACHER';
    }
  }

  onNewAssignmentDeptChange(): void {
    this.newAssignmentSubDeptId = null;
    this.assignmentError = null;
    if (this.newAssignmentDeptId) {
      this.deptApi.getSubDepartmentsByDepartment(this.newAssignmentDeptId).subscribe({
        next: (subs) => {
          this.availableSubDeptsForNewAssignment = Array.isArray(subs) ? subs : (subs?.data || []);
        },
        error: (err) => console.error('Failed to load subdepartments for department', err)
      });
    } else {
      this.availableSubDeptsForNewAssignment = [];
    }
  }

  getFilteredSubDeptsForNewAssignment(): any[] {
    return this.availableSubDeptsForNewAssignment.filter(
      sd => !this.scopedAssignments.some(a => a.subDepartmentId === sd.id)
    );
  }

  addScopedAssignment(): void {
    this.assignmentError = null;
    if (!this.newAssignmentDeptId) {
      this.assignmentError = 'Please select a department.';
      return;
    }
    if (!this.newAssignmentSubDeptId) {
      this.assignmentError = 'Please select a sub-department.';
      return;
    }
    if (!this.newAssignmentRole) {
      this.assignmentError = 'Please choose a role for this sub-department.';
      return;
    }

    if (this.scopedAssignments.some(a => a.subDepartmentId === this.newAssignmentSubDeptId)) {
      this.assignmentError = 'This sub-department already has an assigned role. You can modify its role in the table below.';
      return;
    }

    const dept = this.departments.find(d => d.departmentId === +this.newAssignmentDeptId!);
    const subDept = this.availableSubDeptsForNewAssignment.find(s => s.id === this.newAssignmentSubDeptId)
      || this.subDepartments.find(s => s.id === this.newAssignmentSubDeptId);

    this.scopedAssignments.push({
      departmentId: +this.newAssignmentDeptId!,
      departmentName: dept?.name || '',
      subDepartmentId: this.newAssignmentSubDeptId,
      subDepartmentName: subDept?.name || '',
      role: this.newAssignmentRole
    });

    this.newAssignmentSubDeptId = null;
    this.newAssignmentRole = 'TEACHER';
    this.syncFormWithScopedAssignments();
  }

  removeScopedAssignment(index: number): void {
    this.scopedAssignments.splice(index, 1);
    this.syncFormWithScopedAssignments();
  }

  onAssignmentRoleChanged(assignment: ScopedRoleAssignment, role: 'HOD' | 'TEACHER'): void {
    assignment.role = role;
    this.recalculatePrimaryRole();
  }

  syncFormWithScopedAssignments(): void {
    const subDeptIds = this.scopedAssignments.map(a => a.subDepartmentId);
    this.editForm.get('subDepartmentIds')?.setValue(subDeptIds);
    this.editForm.get('subDepartmentId')?.setValue(subDeptIds.length > 0 ? subDeptIds[0] : null);

    const deptIdsFromAssignments = Array.from(new Set(this.scopedAssignments.map(a => a.departmentId)));
    for (const dId of deptIdsFromAssignments) {
      if (!this.selectedDepartments.includes(dId)) {
        this.selectedDepartments.push(dId);
      }
    }
    this.editForm.get('departmentIds')?.setValue(this.selectedDepartments);

    this.recalculatePrimaryRole();
    this.reloadSubjects();
  }

  getDeptName(deptId: number): string {
    const dept = this.departments.find(d => d.departmentId === deptId);
    return dept ? dept.name : `Dept #${deptId}`;
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


      if (this.f['role'].value !== 'SUPER_ADMIN' && this.f['departmentIds'].errors?.['required']) {
        errors.push('At least one department must be selected.');
      }

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
    const isSuperAdminRole = formValue.role === 'SUPER_ADMIN';

    // For academic roles, require at least one scoped role assignment
    const isAcademic = formValue.role === 'HOD' || formValue.role === 'TEACHER' ||
                       this.primaryRole === 'HOD' || this.primaryRole === 'TEACHER';

    if (isAcademic && this.scopedAssignments.length === 0) {
      this.errorMessage = 'At least one sub-department role assignment is required for HOD / Teacher.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const effectiveRole = this.primaryRole || formValue.role;

    // Prepare payload
    const payload: any = {
      fullName: formValue.fullName.trim(),
      username: formValue.username.trim(),
      email: formValue.email ? formValue.email.trim() : undefined,
      role: effectiveRole,
      primaryRole: effectiveRole,
      departmentIds: isSuperAdminRole ? [] : this.selectedDepartments,
      parentUserId: isSuperAdminRole ? null : formValue.parentUserId,
      reportingManagerIds: isSuperAdminRole ? [] : (formValue.reportingManagerIds || []),
      subDepartmentId: isSuperAdminRole ? null : (this.scopedAssignments.length > 0 ? this.scopedAssignments[0].subDepartmentId : formValue.subDepartmentId),
      subDepartmentIds: isSuperAdminRole ? [] : this.scopedAssignments.map(a => a.subDepartmentId),
      subjectIds: isSuperAdminRole ? [] : (formValue.subjectIds || []),
      roleAssignments: isSuperAdminRole ? [] : this.scopedAssignments.map(a => ({
        departmentId: a.departmentId,
        subDepartmentId: a.subDepartmentId,
        role: a.role
      }))
    };

    // Only include password if provided
    if (formValue.password && formValue.password.trim()) {
      payload.password = formValue.password.trim();
    }

    this.isSubmitting = true;
    if (this.isEdit) {
      this.userApi.updateUser(this.userId, payload).subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          this.successMessage = 'User updated successfully!';

          if (response) {
            if (response.departmentIds) {
              this.selectedDepartments = response.departmentIds;
              this.editForm.patchValue({ departmentIds: response.departmentIds });
            }
            if (response.roleAssignments) {
              this.existingAssignments = response.roleAssignments;
              this.primaryRole = response.primaryRole || response.role;
            }
          }

          // Show success message for 1.5 seconds then redirect/close
          setTimeout(() => {
            if (this.isModal) {
              this.closed.emit(true);
            } else {
              this.router.navigate(['/viewAllUsers']);
            }
          }, 1500);
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
    } else {
      this.userApi.createUser(payload).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.successMessage = 'User created successfully!';

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
            this.errorMessage = 'Username or email already exists. Please choose a different one.';
          } else if (err.status === 403) {
            this.errorMessage = 'You do not have permission to perform this action.';
          } else {
            this.errorMessage = err.error?.message || 'Failed to create user. Please try again.';
          }

          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
      });
    }
  }

  cancel(): void {
    if (this.isModal) {
      this.closed.emit(false);
    } else {
      if (this.editForm.dirty && !confirm('Are you sure? Any unsaved changes will be lost.')) {
        return;
      }
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

  @HostListener('click', ['$event'])
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    if (!target.closest('.manager-multiselect-container')) {
      this.showManagerDropdown = false;
    }
    if (!target.closest('.subdept-multiselect-container')) {
      this.showSubDeptDropdown = false;
    }
    if (!target.closest('.subject-multiselect-container')) {
      this.showSubjectDropdown = false;
    }
  }
}