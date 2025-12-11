import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
  FormControl,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Department } from '../../../Model/department';
import { TaskStatus } from '../../../Model/TaskStatus';
import { userDto } from '../../../Model/userDto';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { TaskDto } from '../../../Model/TaskDto';

interface TaskFormControls {
  title: any;
  description: any;
  status: any;
  startDate: any;
  dueDate: any;
  departmentIds: any;
  assignedToIds: any;
  assignToSelf: any;
}

@Component({
  selector: 'app-update-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './update-task.html',
  styleUrls: ['./update-task.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateTaskComponent implements OnInit, AfterViewInit {
  /* ---------- FORM ---------- */
  taskForm!: FormGroup;
  taskId!: number;

  /* ---------- DATA ---------- */
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  usersByDepartment = new Map<number, userDto[]>();
  filteredUsersByDept = new Map<number, userDto[]>();
  selectedUsersByDeptObj: Record<number, number[]> = {};

 allowedStatuses: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.UPCOMING,
  TaskStatus.IN_PROGRESS,
  TaskStatus.CLOSED,
];

 statuses = [...this.allowedStatuses];

 currentUser: userDto | null = null;

  /* ---------- UI STATE ---------- */
  isSubmitting = false;
  isLoadingTask = false;
  isLoadingDepartments = false;
  isLoadingUsers = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  dateErrorMessage: string | null = null;

  /* ---------- SEARCH ---------- */
  deptSearch = '';
  userSearchByDept: Record<number, string> = {};

  /* ---------- SELECT-ALL ---------- */
  selectAllDepts = false;
  selectAllUsersByDept: Record<number, boolean> = {};

  minDate = new Date().toISOString().split('T')[0];

  /* ---------- DEFERRED ASSIGNED USERS ---------- */
  private _deferredAssignedUserIds: number[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskApiService,
    private departmentService: DepartmentApiService,
    private userService: UserApiService,
    private jwtService: JwtService,
    private cdr: ChangeDetectorRef  // ← Required for OnPush
  ) {
    this.initForm();
  }

  /* ---------- GETTERS ---------- */
  get f() { return this.taskForm.controls as unknown as TaskFormControls; }
  get dueDateCtrl() { return this.taskForm.get('dueDate') as FormControl; }
  get startDateCtrl() { return this.taskForm.get('startDate') as FormControl; }

  /* ---------- LIFECYCLE ---------- */
  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.taskId = +params['taskId'];
      if (!this.taskId || isNaN(this.taskId)) {
        this.errorMessage = 'Invalid task ID.';
        this.router.navigate(['/view-tasks']);
        return;
      }
      this.loadCurrentUserAndTask();
    });

    this.taskForm.get('assignToSelf')?.valueChanges.subscribe((v) => {
      if (v && this.currentUser) this.assignToSelfLogic();
      else this.clearAssignToSelfLogic();
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const input = document.querySelector('#dept-search') as HTMLInputElement;
      input?.focus();
    }, 300);
  }

  /* ---------- FORM SETUP ---------- */
  private initForm(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      status: [null, Validators.required],
      startDate: [''],
      dueDate: ['', Validators.required],
      departmentIds: [[], Validators.required],
      assignedToIds: [[]],
      assignToSelf: [false],
    });

    this.taskForm.get('departmentIds')?.valueChanges.subscribe(() => {
      this.updateFilteredUsers();
      this.expandFirstAccordion();
      this.cdr.markForCheck();
    });

    this.taskForm.get('status')?.valueChanges.subscribe((s) => {
      if (s !== 'UPCOMING') {
        this.taskForm.patchValue({ startDate: '' });
        this.cdr.markForCheck();
      }
    });
  }

  /* ---------- LOAD USER + TASK ---------- */
  private loadCurrentUserAndTask(): void {
    this.isLoadingTask = true;
    this.cdr.markForCheck();

    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.errorMessage = 'Authentication required.';
      this.isLoadingTask = false;
      this.cdr.markForCheck();
      return;
    }

    const userId = this.jwtService.getUserIdFromToken(token);
    if (!userId) {
      this.errorMessage = 'Invalid token - no user ID.';
      this.isLoadingTask = false;
      this.cdr.markForCheck();
      return;
    }

    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        this.currentUser = user;
        this.loadTask();
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Failed to load current user.';
        this.isLoadingTask = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadTask(): void {
    this.taskService.getTaskById(this.taskId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.populateForm(res.data);
          this.loadDepartments();
        } else {
          this.errorMessage = res.message || 'Task not found.';
          this.router.navigate(['/view-tasks']);
        }
        this.isLoadingTask = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Failed to load task.';
        this.isLoadingTask = false;
        this.cdr.markForCheck();
      },
    });
  }

  private populateForm(task: TaskDto): void {
    const start = task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '';
    const due = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';

    this.taskForm.patchValue({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      startDate: start,
      dueDate: due,
      departmentIds: task.departmentIds ?? [],
    });

    this._deferredAssignedUserIds = task.assignedToIds ?? [];

    if (
      this.currentUser &&
      task.assignedToIds &&
      task.assignedToIds.length === 1 &&
      task.assignedToIds[0] === this.currentUser.userId
    ) {
      this.taskForm.patchValue({ assignToSelf: true });
    }

    this.dateErrorMessage = null;
    this.cdr.markForCheck();
  }

  /* ---------- DEPARTMENTS & USERS ---------- */
  private loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.cdr.markForCheck();

    this.departmentService.getAllDepartments().subscribe({
      next: (depts) => {
        let filtered = depts;
        if (this.currentUser?.role === 'HOD') {
          filtered = depts.filter((d) =>
            this.currentUser?.departmentIds?.includes(d.departmentId)
          );
        }
        this.departments = filtered;
        this.filteredDepartments = [...filtered];
        this.isLoadingDepartments = false;
        this.onDeptSearch();
        this.loadUsers();
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Failed to load departments.';
        this.isLoadingDepartments = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadUsers(): void {
    this.isLoadingUsers = true;
    this.cdr.markForCheck();

    this.userService.getAllUsers().subscribe({
      next: (allUsers) => {
        const active = allUsers.filter((u) => u.status === 'ACTIVE');

        this.usersByDepartment.clear();
        this.filteredUsersByDept.clear();

        for (const dept of this.departments) {
          const usersInDept = active
            .filter((u) => u.departmentIds?.includes(dept.departmentId))
            .sort((a, b) => (a.role === 'HOD' ? -1 : b.role === 'HOD' ? 1 : 0));
          this.usersByDepartment.set(dept.departmentId, usersInDept);
          this.filteredUsersByDept.set(dept.departmentId, [...usersInDept]);
        }

        this.isLoadingUsers = false;

        this.applyDeferredUserAssignments();
        this.updateSelectAllStates();
        this.expandFirstAccordion();
        this.onDueDateChange();

        this.cdr.markForCheck(); // Critical: UI updates now
      },
      error: () => {
        this.errorMessage = 'Failed to load users.';
        this.isLoadingUsers = false;
        this.cdr.markForCheck();
      },
    });
  }

  private applyDeferredUserAssignments(): void {
    if (this._deferredAssignedUserIds.length === 0) return;

    this.selectedUsersByDeptObj = {};

    this._deferredAssignedUserIds.forEach((userId) => {
      for (const [deptId, users] of this.usersByDepartment.entries()) {
        if (users.some(u => u.userId === userId)) {
          if (!this.selectedUsersByDeptObj[deptId]) this.selectedUsersByDeptObj[deptId] = [];
          if (!this.selectedUsersByDeptObj[deptId].includes(userId)) {
            this.selectedUsersByDeptObj[deptId].push(userId);
          }
        }
      }
    });

    this.updateAssignedToIds();
    this.updateFilteredUsers();
    this.updateSelectAllStates();
    this._deferredAssignedUserIds = [];

    this.cdr.markForCheck();
  }

  /* ---------- SEARCH & SELECTION ---------- */
  onDeptSearch(): void {
    const q = this.deptSearch.toLowerCase().trim();
    this.filteredDepartments = this.departments.filter((d) =>
      d.name.toLowerCase().includes(q)
    );
    this.updateSelectAllDepts();
    this.cdr.markForCheck();
  }

  clearDeptSearch(): void {
    this.deptSearch = '';
    this.onDeptSearch();
  }

  onUserSearch(deptId: number): void {
    const q = (this.userSearchByDept[deptId] ?? '').toLowerCase().trim();
    const all = this.usersByDepartment.get(deptId) ?? [];
    const filtered = all.filter(u =>
      u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
    this.filteredUsersByDept.set(deptId, filtered);
    this.updateSelectAllUsersForDept(deptId);
    this.cdr.markForCheck();
  }

  clearUserSearch(deptId: number): void {
    this.userSearchByDept[deptId] = '';
    this.onUserSearch(deptId);
  }

  toggleSelectAllDepts(): void {
    this.selectAllDepts = !this.selectAllDepts;
    const ids = this.selectAllDepts ? this.filteredDepartments.map(d => d.departmentId) : [];
    this.taskForm.patchValue({ departmentIds: ids });
    if (!this.selectAllDepts) this.selectedUsersByDeptObj = {};
    this.updateAssignedToIds();
    this.updateFilteredUsers();
    this.cdr.markForCheck();
  }

  toggleSelectAllUsers(deptId: number): void {
    const users = this.filteredUsersByDept.get(deptId) ?? [];
    const enabled = users.filter(u => !this.isUserSelectionDisabled(u));
    const selected = this.selectedUsersByDeptObj[deptId] ?? [];
    const allSelected = enabled.every(u => selected.includes(u.userId));

    this.selectedUsersByDeptObj[deptId] = allSelected ? [] : enabled.map(u => u.userId);
    this.updateAssignedToIds();
    this.updateSelectAllUsersForDept(deptId);
    this.cdr.markForCheck();
  }

  updateDepartmentSelection(deptId: number, checked: boolean): void {
    if (this.taskForm.value.assignToSelf) return;

    let ids = [...this.taskForm.value.departmentIds];
    if (checked && !ids.includes(deptId)) ids.push(deptId);
    else if (!checked) {
      ids = ids.filter(id => id !== deptId);
      delete this.selectedUsersByDeptObj[deptId];
    }
    this.taskForm.patchValue({ departmentIds: ids });
    this.updateAssignedToIds();
    this.updateSelectAllDepts();
    this.cdr.markForCheck();
  }

  updateUserSelection(deptId: number, userId: number, checked: boolean): void {
    if (this.taskForm.value.assignToSelf && userId !== this.currentUser?.userId) return;

    this.selectedUsersByDeptObj[deptId] ??= [];
    if (checked && !this.selectedUsersByDeptObj[deptId].includes(userId)) {
      this.selectedUsersByDeptObj[deptId].push(userId);
    } else if (!checked) {
      this.selectedUsersByDeptObj[deptId] = this.selectedUsersByDeptObj[deptId].filter(id => id !== userId);
    }
    this.updateAssignedToIds();
    this.updateSelectAllUsersForDept(deptId);
    this.cdr.markForCheck();
  }

  private updateAssignedToIds(): void {
    const all = Object.values(this.selectedUsersByDeptObj).flat();
    this.taskForm.patchValue({ assignedToIds: all });
  }

  private updateSelectAllDepts(): void {
    const sel = this.taskForm.value.departmentIds;
    this.selectAllDepts = this.filteredDepartments.length > 0 &&
      this.filteredDepartments.every(d => sel.includes(d.departmentId));
  }

  private updateSelectAllUsersForDept(deptId: number): void {
    const users = this.filteredUsersByDept.get(deptId) ?? [];
    const sel = this.selectedUsersByDeptObj[deptId] ?? [];
    const enabled = users.filter(u => !this.isUserSelectionDisabled(u));
    this.selectAllUsersByDept[deptId] = enabled.length > 0 && enabled.every(u => sel.includes(u.userId));
  }

  private updateFilteredUsers(): void {
    const ids = this.taskForm.value.departmentIds as number[];
    ids.forEach(id => {
      if (!this.filteredUsersByDept.has(id)) {
        const users = this.usersByDepartment.get(id) ?? [];
        this.filteredUsersByDept.set(id, [...users]);
      }
      this.onUserSearch(id);
    });
  }

  private updateSelectAllStates(): void {
    this.updateSelectAllDepts();
    (this.taskForm.value.departmentIds as number[]).forEach(id => this.updateSelectAllUsersForDept(id));
  }

  private expandFirstAccordion(): void {
    setTimeout(() => {
      const first = (this.taskForm.value.departmentIds as number[])[0];
      if (first) {
        const btn = document.querySelector(`[data-bs-target="#collapse-${first}"]`) as HTMLElement;
        btn?.click();
      }
    }, 100);
  }

  isUserSelectionDisabled(user: userDto): boolean {
    if (!this.currentUser) return true;
    if (this.currentUser.role === 'ADMIN') return false;
    if (this.currentUser.role === 'HOD') {
      const sameDept = user.departmentIds?.some(id =>
        this.currentUser?.departmentIds?.includes(id)
      );
      return !(user.userId === this.currentUser.userId || sameDept);
    }
    return true;
  }

  private assignToSelfLogic(): void {
    if (!this.currentUser) return;
    const myDepts = this.currentUser.departmentIds ?? [];
    const myId = this.currentUser.userId;

    this.taskForm.patchValue({ departmentIds: myDepts });
    this.selectedUsersByDeptObj = {};
    myDepts.forEach(id => (this.selectedUsersByDeptObj[id] = [myId]));
    this.updateAssignedToIds();
    this.updateSelectAllStates();
    this.expandFirstAccordion();
    this.cdr.markForCheck();
  }

  private clearAssignToSelfLogic(): void {
    this.selectedUsersByDeptObj = {};
    this.updateAssignedToIds();
    Object.keys(this.selectAllUsersByDept).forEach(k => (this.selectAllUsersByDept[+k] = false));
    this.cdr.markForCheck();
  }

  /* ---------- DATE VALIDATION ---------- */
  private validateDates(start: string | null, due: string): { valid: boolean; msg?: string } {
    if (!due) return { valid: false, msg: 'Due date is required.' };
    return { valid: true };
  }

  onStartDateChange(): void {
    const { startDate, dueDate } = this.taskForm.value;
    const v = this.validateDates(startDate, dueDate);
    this.dateErrorMessage = v.valid ? null : v.msg!;
    this.cdr.markForCheck();
  }

  onDueDateChange(): void {
    const { startDate, dueDate } = this.taskForm.value;
    const v = this.validateDates(startDate, dueDate);
    this.dateErrorMessage = v.valid ? null : v.msg!;
    this.cdr.markForCheck();
  }

  focusInput(event: MouseEvent, inputEl: HTMLInputElement): void {
    event.preventDefault();
    inputEl.focus();
    inputEl.showPicker?.();
  }

  getDepartmentName(id: number): string {
    return this.departments.find(d => d.departmentId === id)?.name ?? `Dept ${id}`;
  }

  getDepartmentNames(ids: number[]): string {
    return ids.map(id => this.getDepartmentName(id)).filter(Boolean).join(', ');
  }

  /* ---------- SUBMIT ---------- */
  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.errorMessage = 'Please fill all required fields correctly.';
      this.cdr.markForCheck();
      return;
    }

    const { startDate, dueDate } = this.taskForm.value;
    const v = this.validateDates(startDate, dueDate);
    if (!v.valid) {
      this.dateErrorMessage = v.msg!;
      this.cdr.markForCheck();
      return;
    }

    const payload = {
      ...this.taskForm.value,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      dueDate: new Date(dueDate).toISOString(),
      departmentIds: this.taskForm.value.departmentIds,
      assignedToIds: this.taskForm.value.assignedToIds,
      requiresApproval: this.currentUser?.role === 'HOD',
    };

    this.isSubmitting = true;
    this.cdr.markForCheck();

    this.taskService.updateTask(this.taskId, payload).subscribe({
      next: () => {
        this.successMessage = 'Task updated successfully!';
        this.cdr.markForCheck();
        setTimeout(() => this.router.navigate(['/task', this.taskId]), 1500);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to update task.';
        this.isSubmitting = false;
        this.cdr.markForCheck();
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/task', this.taskId]);
  }
}