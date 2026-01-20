import { CommonModule } from '@angular/common';
import { Component, OnInit, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  FormControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { Department } from '../../../Model/department';
import { TaskStatus } from '../../../Model/TaskStatus';
import { UserApiService } from '../../../Services/UserApiService';
import { userDto } from '../../../Model/userDto';
import { TaskDto } from '../../../Model/TaskDto';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../../../Services/auth-api-service';
import * as bootstrap from 'bootstrap'; // ← for modal control

// You can create this enum in models if you prefer
type RecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY';
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
  selector: 'app-add-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './test2.html',
  styleUrls: ['./test2.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Test2 implements OnInit, AfterViewInit {
  taskForm!: FormGroup;
  isLoadingDepartments = false;
  isLoadingUsers = false;

  // ── existing properties ──────────────────────────────────────
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  usersByDepartment: Map<number, userDto[]> = new Map();
  filteredUsersByDept: Map<number, userDto[]> = new Map();
  selectedUsersByDeptObj: Record<number, number[]> = {};
  statuses = ['UPCOMING', 'PENDING'];
  currentUser: userDto | null = null;

  isSubmitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  dueDateErrorMessage: string | null = null;
  startDateErrorMessage: string | null = null;

  deptSearch = '';
  userSearchByDept: Record<number, string> = {};

  selectAllDepts = false;
  selectAllUsersByDept: Record<number, boolean> = {};

  token = '';
  userId: number | null = null;
  minDate = new Date().toISOString().split('T')[0];

  // ── NEW: Recurrence fields ───────────────────────────────────
  private recurrenceModal!: bootstrap.Modal;

  constructor(
    private fb: FormBuilder,
    private taskService: TaskApiService,
    private departmentService: DepartmentApiService,
    private userService: UserApiService,
    private jwtService: JwtService,
    private router: Router,
    private authApiService: AuthApiService
  ) {
    this.initForm();
  }

  focusInput(event: MouseEvent, inputEl: HTMLInputElement): void {
    // Prevent the click from bubbling to the native picker twice
    event.preventDefault();
    inputEl.focus();
    // For some browsers you also need to programmatically open the picker:
    inputEl.showPicker?.();   // Chrome/Edge/Firefox (2025+)
  }
  onDeptSearch(): void {
    const query = this.deptSearch.toLowerCase().trim();
    this.filteredDepartments = this.departments.filter((d) =>
      d.name.toLowerCase().includes(query)
    );
    this.updateSelectAllDepts();
  }
  private updateSelectAllDepts(): void {
    const selected = this.taskForm.value.departmentIds;
    this.selectAllDepts =
      this.filteredDepartments.length > 0 &&
      this.filteredDepartments.every((d) => selected.includes(d.departmentId));
  }
  clearDeptSearch(): void {
    this.deptSearch = '';
    this.onDeptSearch();
  }
  toggleSelectAllDepts(): void {
    this.selectAllDepts = !this.selectAllDepts;
    const ids = this.selectAllDepts
      ? this.filteredDepartments.map((d) => d.departmentId)
      : [];

    this.taskForm.patchValue({ departmentIds: ids });
    if (!this.selectAllDepts) {
      this.selectedUsersByDeptObj = {};
      this.taskForm.patchValue({ assignedToIds: [] });
    }
    this.updateFilteredUsers();
  }
  private updateFilteredUsers(): void {
    const selectedDeptIds = this.taskForm.value.departmentIds;
    for (const deptId of selectedDeptIds) {
      if (!this.filteredUsersByDept.has(deptId)) {
        const users = this.usersByDepartment.get(deptId) || [];
        this.filteredUsersByDept.set(deptId, [...users]);
      }
      this.onUserSearch(deptId);
    }
  }

  toggleSelectAllUsers(deptId: number): void {
    const users = this.filteredUsersByDept.get(deptId) || [];
    const enabledUsers = users.filter((u) => !this.isUserSelectionDisabled(u));
    const currentlySelected = this.selectedUsersByDeptObj[deptId] || [];

    const allSelected = enabledUsers.every((u) =>
      currentlySelected.includes(u.userId)
    );

    this.selectedUsersByDeptObj[deptId] = allSelected ? [] : enabledUsers.map((u) => u.userId);
    this.updateAssignedToIds();
    this.updateSelectAllUsersForDept(deptId);
  }

  updateDepartmentSelection(deptId: number, checked: boolean): void {
    const assignToSelf = this.taskForm.value.assignToSelf;

    if (assignToSelf) {
      // Block all changes — only allow current user's depts
      return;
    }

    let selected = [...this.taskForm.value.departmentIds];
    if (checked && !selected.includes(deptId)) {
      selected.push(deptId);
    } else if (!checked) {
      selected = selected.filter((id) => id !== deptId);
      delete this.selectedUsersByDeptObj[deptId];
    }
    this.taskForm.patchValue({ departmentIds: selected });
    this.updateAssignedToIds();
    this.updateSelectAllDepts();
  }

  updateUserSelection(deptId: number, userId: number, checked: boolean): void {
    const assignToSelf = this.taskForm.value.assignToSelf;

    if (assignToSelf) {
      // Only allow if it's the current user
      if (userId !== this.currentUser?.userId) {
        return; // block
      }
    }

    this.selectedUsersByDeptObj[deptId] ??= [];
    if (checked && !this.selectedUsersByDeptObj[deptId].includes(userId)) {
      this.selectedUsersByDeptObj[deptId].push(userId);
    } else if (!checked) {
      this.selectedUsersByDeptObj[deptId] = this.selectedUsersByDeptObj[deptId].filter(
        (id) => id !== userId
      );
    }
    this.updateAssignedToIds();
    this.updateSelectAllUsersForDept(deptId);
  }
  getDepartmentName(id: number): string {
    return this.departments.find((d) => d.departmentId === id)?.name || `Dept ${id}`;
  }
  getDepartmentNames(deptIds: number[]): string {
    if (!deptIds?.length) return '';
    const names = deptIds
      .map(id => this.departments.find(d => d.departmentId === id)?.name)
      .filter(Boolean)
      .join(', ');
    return names;
  }

  private updateAssignedToIds(): void {
    const all = Object.values(this.selectedUsersByDeptObj).flat();
    this.taskForm.patchValue({ assignedToIds: all });
  }

  onUserSearch(deptId: number): void {
    const query = (this.userSearchByDept[deptId] || '').toLowerCase().trim();
    const allUsers = this.usersByDepartment.get(deptId) || [];
    const filtered = allUsers.filter(
      (u) =>
        u.fullName.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query)
    );
    this.filteredUsersByDept.set(deptId, filtered);
    this.updateSelectAllUsersForDept(deptId);
  }

  clearUserSearch(deptId: number): void {
    this.userSearchByDept[deptId] = '';
    this.onUserSearch(deptId);
  }
  private updateSelectAllUsersForDept(deptId: number): void {
    const users = this.filteredUsersByDept.get(deptId) || [];
    const selected = this.selectedUsersByDeptObj[deptId] || [];
    const enabled = users.filter((u) => !this.isUserSelectionDisabled(u));
    this.selectAllUsersByDept[deptId] =
      enabled.length > 0 && enabled.every((u) => selected.includes(u.userId));
  }

  isUserSelectionDisabled(user: userDto): boolean {
    if (!this.currentUser) return true;
    if (this.currentUser.role === 'ADMIN') return false;
    if (this.currentUser.role === 'HOD') {
      const isSelf = user.userId === this.currentUser.userId;
      const sameDept = user.departmentIds?.some((id) =>
        this.currentUser?.departmentIds?.includes(id)
      );
      return !(isSelf || sameDept);
    }
    return true;
  }


  get dueDateCtrl() { return this.taskForm.get('dueDate') as FormControl; }
  get startDateCtrl() { return this.taskForm.get('startDate') as FormControl; }
  onStartDateChange(): void {
    const { startDate, dueDate, status } = this.taskForm.value;
    const validation = this.validateDatesClientSide(startDate, dueDate, status);
    this.startDateErrorMessage = validation.valid ? null : validation.msg!;
  }

  onDueDateChange(): void {
    const { startDate, dueDate, status } = this.taskForm.value;
    const validation = this.validateDatesClientSide(startDate, dueDate, status);
    this.dueDateErrorMessage = validation.valid ? null : validation.msg!;
  }
  ngOnInit(): void {
    const storedToken = this.jwtService.getAccessToken();
    this.token = storedToken ?? '';
    this.userId = this.jwtService.getUserIdFromToken(this.token);

    if (this.userId) {
      this.userService.getUserById(this.userId).subscribe({
        next: (res) => {
          this.currentUser = res;
          this.loadDepartments();
        },
        // ... error ...
      });
    } else {
      this.loadDepartments();
    }

    // NEW: Listen to "Assign to Self"
    this.taskForm.get('assignToSelf')?.valueChanges.subscribe((assignToSelf) => {
      if (assignToSelf && this.currentUser) {
        this.assignToSelfLogic();
      } else {
        this.clearAssignToSelfLogic();
      }
    });

    // Listen to recurring checkbox
    this.taskForm.get('isRecurring')?.valueChanges.subscribe((isRecurring) => {
      if (isRecurring) {
        setTimeout(() => this.openRecurrenceModal(), 50);
      }
    });
  }
  cancel(): void {
    this.authApiService.goToDashboard();
  }
  private assignToSelfLogic(): void {
    if (!this.currentUser) return;

    const myDeptIds = this.currentUser.departmentIds || [];
    const myUserId = this.currentUser.userId;

    // 1. Auto-select my departments
    this.taskForm.patchValue({ departmentIds: myDeptIds });

    // 2. Auto-select myself in each department
    this.selectedUsersByDeptObj = {};
    myDeptIds.forEach(deptId => {
      this.selectedUsersByDeptObj[deptId] = [myUserId];
    });

    // 3. Update assignedToIds
    this.updateAssignedToIds();

    // 4. Update UI states
    this.updateSelectAllDepts();
    myDeptIds.forEach(id => this.updateSelectAllUsersForDept(id));

    // 5. Expand first accordion
    this.expandFirstAccordion();
  }

  private clearAssignToSelfLogic(): void {
    // Optional: keep departments selected, or clear them?
    // Let's keep them — user may want to assign to others too
    // But clear user selections
    this.selectedUsersByDeptObj = {};
    this.updateAssignedToIds();
    Object.keys(this.selectAllUsersByDept).forEach(key => {
      this.selectAllUsersByDept[+key] = false;
    });
  }

  expandFirstAccordion(): void {
    setTimeout(() => {
      const firstDeptId = this.taskForm.value.departmentIds[0];
      if (firstDeptId) {
        const el = document.getElementById(`collapse-${firstDeptId}`);
        if (el && !el.classList.contains('show')) {
          const btn = document.querySelector(`[data-bs-target="#collapse-${firstDeptId}"]`) as HTMLElement;
          btn?.click();
        }
      }
    }, 100);
  }
  loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.departmentService.getAllDepartments().subscribe({
      next: (res) => {
        let filtered = res;
        if (this.currentUser?.role === 'HOD') {
          filtered = res.filter(
            (d) =>
              this.currentUser?.departmentIds?.includes(d.departmentId) &&
              d.name.toLowerCase() !== 'administration'
          );
        }
        this.departments = filtered;
        this.filteredDepartments = [...filtered];
        this.isLoadingDepartments = false;

        // Critical Fix: Trigger search to show list
        this.onDeptSearch();
        this.loadUsers();
      },
      error: () => {
        this.errorMessage = 'Failed to load departments.';
        this.isLoadingDepartments = false;
      },
    });
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    this.userService.getAllUsers().subscribe({
      next: (res) => {
        const activeUsers = res.filter((u) => u.status === 'ACTIVE');
        this.usersByDepartment.clear();
        this.filteredUsersByDept.clear();

        for (const dept of this.departments) {
          const usersInDept = activeUsers
            .filter((u) => u.departmentIds?.includes(dept.departmentId))
            .sort((a, b) => {
              if (a.role === 'HOD' && b.role !== 'HOD') return -1;
              if (b.role === 'HOD' && a.role !== 'HOD') return 1;
              return a.fullName.localeCompare(b.fullName);
            });
          this.usersByDepartment.set(dept.departmentId, usersInDept);
          this.filteredUsersByDept.set(dept.departmentId, [...usersInDept]);
        }
        this.isLoadingUsers = false;
        this.updateFilteredUsers();
      },
      error: () => {
        this.errorMessage = 'Failed to load users.';
        this.isLoadingUsers = false;
      },
    });
  }

  private validateDatesClientSide(start: string, due: string, status: TaskStatus | null): { valid: boolean; msg?: string } {
    if (!due) return { valid: false, msg: 'Due date is required.' };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = start ? new Date(start) : new Date();
    const dueDate = new Date(due);

    const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const dueOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    // Sunday check
    if (startOnly.getDay() === 0) return { valid: false, msg: 'Start date cannot be on Sunday' };
    if (dueOnly.getDay() === 0) return { valid: false, msg: 'Due date cannot be on Sunday' };

    // Due >= Start
    if (dueOnly < startOnly) return { valid: false, msg: 'Due date must be on or after start date' };

    // Status rules
    if (status === 'PENDING') {
      if (dueOnly < today) return { valid: false, msg: 'For PENDING status, due date cannot be in the past' };
    }

    if (status === 'UPCOMING') {
      if (!startOnly.getTime() || startOnly <= today) {
        return { valid: false, msg: 'For UPCOMING status, start date must be in the future' };
      }
    }

    return { valid: true };
  }
  validateDates(start: string, due: string): { valid: boolean; msg?: string } {
    if (!due) return { valid: false, msg: 'Due date is required.' };

    const startDate = start ? new Date(start) : new Date();
    const dueDate = new Date(due);

    const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const dueOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    if (dueOnly < startOnly) {
      return { valid: false, msg: 'Due date cannot be before start date.' };
    }

    return { valid: true };
  }
  ngAfterViewInit(): void {
    // Initialize bootstrap modal
    const modalEl = document.getElementById('recurrenceModal');
    if (modalEl) {
      this.recurrenceModal = new bootstrap.Modal(modalEl, {
        backdrop: 'static',
        keyboard: false,
      });
    }

    // ... existing afterViewInit code ...
  }

  private initForm(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', Validators.maxLength(2000)],
      status: [null, Validators.required],
      startDate: [''],
      dueDate: ['', Validators.required],
      departmentIds: [[], Validators.required],
      assignedToIds: [[]],
      assignToSelf: [false],

      // ── NEW fields ── all optional
      isRecurring: [false],
      recurrenceType: ['DAILY'],
      recurrenceInterval: [1, Validators.min(1)],
      recurrenceEndDate: [''],
    });

    // ... existing valueChanges subscriptions ...
  }

  get f() {
    return this.taskForm.controls;
  }

  // ── NEW: Modal handlers ───────────────────────────────────────

  openRecurrenceModal(): void {
    if (this.recurrenceModal) {
      this.recurrenceModal.show();
    }
  }

  onRecurrenceConfirmed(): void {
    // Ensure interval has a value (default 1)
    const intervalCtrl = this.taskForm.get('recurrenceInterval');
    if (!intervalCtrl?.value || intervalCtrl.value < 1) {
      intervalCtrl?.setValue(1);
    }

    // Optional: you could add more client-side validation here
    // e.g. end date > due date, etc.

    // Modal closes automatically via data-bs-dismiss
  }

  // ── Enhanced submit ───────────────────────────────────────────

  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.errorMessage = 'Please fill all required fields correctly.';
      return;
    }

    const formValue = this.taskForm.value;

    // Date validation (existing)
    const dateValidation = this.validateDatesClientSide(
      formValue.startDate,
      formValue.dueDate,
      formValue.status
    );
    if (!dateValidation.valid) {
      this.dueDateErrorMessage = dateValidation.msg!;
      return;
    }

    if (!formValue.departmentIds?.length) {
      this.errorMessage = 'Please select at least one department.';
      return;
    }

    let finalAssigned = [...(formValue.assignedToIds || [])];
    if (formValue.assignToSelf && this.currentUser) {
      if (!finalAssigned.includes(this.currentUser.userId)) {
        finalAssigned.push(this.currentUser.userId);
      }
    }

    // Prepare payload
    const payload: any = {
      ...formValue,
      startDate: formValue.startDate
        ? new Date(formValue.startDate).toISOString()
        : new Date().toISOString(),
      dueDate: new Date(formValue.dueDate).toISOString(),
      departmentIds: formValue.departmentIds,
      assignedToIds: finalAssigned,
    };

    // ── NEW: Clean recurrence fields ──
    if (!formValue.isRecurring) {
      delete payload.recurrenceType;
      delete payload.recurrenceInterval;
      delete payload.recurrenceEndDate;
    } else {
      // Ensure interval is number ≥ 1
      payload.recurrenceInterval = Number(formValue.recurrenceInterval) || 1;

      // Convert end date to ISO or remove if empty
      if (formValue.recurrenceEndDate) {
        payload.recurrenceEndDate = new Date(formValue.recurrenceEndDate).toISOString();
      } else {
        delete payload.recurrenceEndDate;
      }
    }

    this.isSubmitting = true;
    this.taskService.createTask(payload).subscribe({
      next: (response) => {
        this.successMessage = 'Task created successfully!';
        this.isSubmitting = false;
        setTimeout(() => {
          this.resetForm();
          this.authApiService.goToDashboard();
        }, 1400);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage = err.error?.message || 'Failed to create task.';
        this.isSubmitting = false;
      },
    });
  }

  resetForm(): void {
    this.taskForm.reset({
      title: '',
      description: '',
      status: null,
      startDate: '',
      dueDate: '',
      departmentIds: [],
      assignedToIds: [],
      assignToSelf: false,
      isRecurring: false,
      recurrenceType: 'DAILY',
      recurrenceInterval: 1,
      recurrenceEndDate: '',
    });
    // ... reset other UI states ...
  }

  // ... rest of your existing methods remain unchanged ...
}