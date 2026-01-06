import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
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
import { Modal } from 'bootstrap';
import { Subscription } from 'rxjs';

interface TaskFormControls {
  title: any;
  description: any;
  status: any;
  startDate: any;
  dueDate: any;
  departmentIds: any;
  assignedToIds: any;
  assignToSelf: any;
  isRecurring: any;
  recurrenceType: any;
  interval: any;
  endDate: any;
}

@Component({
  selector: 'app-add-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './test2.html',
  styleUrls: ['./test2.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Test2 implements OnInit, AfterViewInit, OnDestroy {
  taskForm!: FormGroup;
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  usersByDepartment: Map<number, userDto[]> = new Map();
  filteredUsersByDept: Map<number, userDto[]> = new Map();
  selectedUsersByDeptObj: Record<number, number[]> = {};
  statuses = ["UPCOMING", "PENDING"];
  currentUser: userDto | null = null;

  // UI States
  isSubmitting = false;
  isLoadingDepartments = false;
  isLoadingUsers = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  dueDateErrorMessage: string | null = null;
  startDateErrorMessage: string | null = null;
  showQuickAssign = false;

  // Search
  deptSearch = '';
  userSearchByDept: Record<number, string> = {};

  // Select All
  selectAllDepts = false;
  selectAllUsersByDept: Record<number, boolean> = {};

  token = '';
  userId: number | null = null;
  minDate = new Date().toISOString().split('T')[0];

  // Recurring Modal
  private recurringModal?: Modal;
  tempRecurrenceType: string | null = null;
  tempInterval: number = 1;
  tempEndDate: string = '';
  wasNewRecurring = true;

  // Form subscriptions
  private formSubscriptions: Subscription[] = [];

  // UI State
  activeStep = 1;
  showHelpText = false;
  characterCount = 0;

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

  ngOnInit(): void {
    const storedToken = this.jwtService.getAccessToken();
    this.token = storedToken ?? '';
    this.userId = this.jwtService.getUserIdFromToken(this.token);

    if (this.userId) {
      this.userService.getUserById(this.userId).subscribe({
        next: (res) => {
          this.currentUser = res;
          this.loadDepartments();
          this.setupFormListeners();
        },
        error: (err) => {
          console.error('Failed to load current user:', err);
          this.loadDepartments();
          this.setupFormListeners();
        }
      });
    } else {
      this.loadDepartments();
      this.setupFormListeners();
    }

    // Listen for form changes to update step validation
    this.taskForm.valueChanges.subscribe(() => {
      this.updateStepValidation();
    });
  }

  private setupFormListeners(): void {
    // Listen to "Assign to Self" changes
    const assignToSelfSub = this.taskForm.get('assignToSelf')?.valueChanges.subscribe((assignToSelf) => {
      if (assignToSelf && this.currentUser) {
        this.assignToSelfLogic();
      } else {
        this.clearAssignToSelfLogic();
      }
    });
    if (assignToSelfSub) this.formSubscriptions.push(assignToSelfSub);

    // Listen to description changes for character count
    const descSub = this.taskForm.get('description')?.valueChanges.subscribe(value => {
      this.characterCount = value?.length || 0;
    });
    if (descSub) this.formSubscriptions.push(descSub);

    // Listen to department selection changes
    const deptSub = this.taskForm.get('departmentIds')?.valueChanges.subscribe(() => {
      this.updateStepValidation();
    });
    if (deptSub) this.formSubscriptions.push(deptSub);

    // Listen to status changes
    const statusSub = this.taskForm.get('status')?.valueChanges.subscribe(() => {
      this.updateStepValidation();
    });
    if (statusSub) this.formSubscriptions.push(statusSub);
  }

  private updateStepValidation(): void {
    // Step 1 validation (Basic Info)
    if (this.taskForm.get('title')?.valid && this.taskForm.get('status')?.valid) {
      this.activeStep = Math.max(this.activeStep, 2);
    }

    // Step 2 validation (Departments)
    if (this.taskForm.get('departmentIds')?.value?.length > 0) {
      this.activeStep = Math.max(this.activeStep, 3);
    }

    // Step 3 validation (Due Date)
    if (this.taskForm.get('dueDate')?.valid) {
      this.activeStep = Math.max(this.activeStep, 4);
    }
  }

  private assignToSelfLogic(): void {
    if (!this.currentUser) return;

    const myDeptIds = this.currentUser.departmentIds || [];
    const myUserId = this.currentUser.userId;

    // Auto-select my departments
    this.taskForm.patchValue({ departmentIds: myDeptIds });

    // Auto-select myself in each department
    this.selectedUsersByDeptObj = {};
    myDeptIds.forEach(deptId => {
      this.selectedUsersByDeptObj[deptId] = [myUserId];
    });

    // Update assignedToIds
    this.updateAssignedToIds();

    // Update UI states
    this.updateSelectAllDepts();
    myDeptIds.forEach(id => this.updateSelectAllUsersForDept(id));

    // Expand first accordion
    this.expandFirstAccordion();
  }

  private clearAssignToSelfLogic(): void {
    // Keep departments selected but clear user selections
    this.selectedUsersByDeptObj = {};
    this.updateAssignedToIds();
    Object.keys(this.selectAllUsersByDept).forEach(key => {
      this.selectAllUsersByDept[+key] = false;
    });
  }

  ngAfterViewInit(): void {
    // Focus search after view init
    setTimeout(() => {
      const searchInput = document.querySelector('#taskTitle') as HTMLInputElement;
      searchInput?.focus();
    }, 300);

    // Initialize modals
    this.initModals();

    // Add scroll listener for progress bar
    this.setupScrollListener();
  }

  private setupScrollListener(): void {
    window.addEventListener('scroll', this.onScroll.bind(this));
  }

  private onScroll(): void {
    const formTop = document.querySelector('.task-form-body')?.getBoundingClientRect().top || 0;
    if (formTop < 100) {
      document.querySelector('.floating-progress')?.classList.add('active');
    } else {
      document.querySelector('.floating-progress')?.classList.remove('active');
    }
  }

  private initModals(): void {
    const modalElement = document.getElementById('recurringModal');
    if (modalElement) {
      this.recurringModal = new Modal(modalElement);
    }
  }

  private initForm(): void {
    this.taskForm = this.fb.group({
      title: [
        '',
        [
          Validators.required,
          Validators.maxLength(255),
        ],
      ],
      description: [
        '',
        [
          Validators.maxLength(2000),
        ],
      ],
      status: [null, Validators.required],
      startDate: [''],
      dueDate: ['', Validators.required],
      departmentIds: [[], Validators.required],
      assignedToIds: [[]],
      assignToSelf: [false],
      isRecurring: [false],
      recurrenceType: [null],
      interval: [1],
      endDate: [''],
    });
  }
getHodCount(departmentId: number): number {
  const users = this.usersByDepartment.get(departmentId) || [];
  return users.filter(u => u.role === 'HOD').length;
}

  get f(): TaskFormControls {
    return this.taskForm.controls as unknown as TaskFormControls;
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

        this.onDeptSearch();
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to load departments:', err);
        this.errorMessage = 'Failed to load departments. Please try again.';
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
      error: (err) => {
        console.error('Failed to load users:', err);
        this.errorMessage = 'Failed to load users.';
        this.isLoadingUsers = false;
      },
    });
  }

  // === SEARCH ===
  onDeptSearch(): void {
    const query = this.deptSearch.toLowerCase().trim();
    this.filteredDepartments = this.departments.filter((d) =>
      d.name.toLowerCase().includes(query)
    );
    this.updateSelectAllDepts();
  }

  clearDeptSearch(): void {
    this.deptSearch = '';
    this.onDeptSearch();
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

  // === SELECT ALL ===
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

  private updateSelectAllDepts(): void {
    const selected = this.taskForm.value.departmentIds;
    this.selectAllDepts =
      this.filteredDepartments.length > 0 &&
      this.filteredDepartments.every((d) => selected.includes(d.departmentId));
  }

  private updateSelectAllUsersForDept(deptId: number): void {
    const users = this.filteredUsersByDept.get(deptId) || [];
    const selected = this.selectedUsersByDeptObj[deptId] || [];
    const enabled = users.filter((u) => !this.isUserSelectionDisabled(u));
    this.selectAllUsersByDept[deptId] =
      enabled.length > 0 && enabled.every((u) => selected.includes(u.userId));
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

  focusInput(event: MouseEvent, inputEl: HTMLInputElement): void {
    event.preventDefault();
    inputEl.focus();
    inputEl.showPicker?.();
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

  getDepartmentName(id: number): string {
    return this.departments.find((d) => d.departmentId === id)?.name || `Department ${id}`;
  }

  // Recurring Handlers
  onRecurringToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.wasNewRecurring = !this.taskForm.value.recurrenceType;
      this.openRecurringModalAdd();
    } else {
      this.clearRecurring();
    }
  }

  private openRecurringModalAdd(): void {
    this.tempRecurrenceType = this.taskForm.value.recurrenceType;
    this.tempInterval = this.taskForm.value.interval || 1;
    this.tempEndDate = this.taskForm.value.endDate;
    this.recurringModal?.show();
  }

  onRecurringCancelAdd(): void {
    this.recurringModal?.hide();
    if (this.wasNewRecurring) {
      this.taskForm.patchValue({ isRecurring: false });
    }
  }

  onRecurringSubmitAdd(): void {
    if (!this.tempRecurrenceType || this.tempInterval < 1) {
      this.errorMessage = 'Please select a recurrence type and enter a valid interval.';
      return;
    }
    this.taskForm.patchValue({
      recurrenceType: this.tempRecurrenceType,
      interval: this.tempInterval,
      endDate: this.tempEndDate
    });
    this.recurringModal?.hide();
  }

  private clearRecurring(): void {
    this.taskForm.patchValue({
      recurrenceType: null,
      interval: 1,
      endDate: ''
    });
  }

  // New UI Methods
  toggleHelpText(): void {
    this.showHelpText = !this.showHelpText;
  }

  quickAssign(deptIds: number[], userIds: number[]): void {
    this.taskForm.patchValue({ departmentIds: deptIds });
    this.selectedUsersByDeptObj = {};
    deptIds.forEach((deptId, index) => {
      if (userIds[index]) {
        this.selectedUsersByDeptObj[deptId] = [userIds[index]];
      }
    });
    this.updateAssignedToIds();
    this.updateFilteredUsers();
  }

  getFormProgress(): number {
    const controls = Object.values(this.taskForm.controls);
    const validCount = controls.filter(c => c.valid).length;
    return Math.round((validCount / controls.length) * 100);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.errorMessage = 'Please fill all required fields correctly.';
      this.taskForm.markAllAsTouched();
      
      // Scroll to first error
      setTimeout(() => {
        const firstError = document.querySelector('.is-invalid');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    const { startDate, dueDate, departmentIds, assignedToIds, assignToSelf, status, isRecurring, recurrenceType, interval, endDate } = this.taskForm.value;

    // Client-side date validation
    const dateValidation = this.validateDatesClientSide(startDate, dueDate, status);
    if (!dateValidation.valid) {
      this.dueDateErrorMessage = dateValidation.msg!;
      return;
    }

    if (!departmentIds?.length) {
      this.errorMessage = 'Please select at least one department.';
      return;
    }

    if (isRecurring && !recurrenceType) {
      this.errorMessage = 'Please provide recurring details.';
      return;
    }

    const finalAssigned = [...assignedToIds];
    if (assignToSelf && this.currentUser && !finalAssigned.includes(this.currentUser.userId)) {
      finalAssigned.push(this.currentUser.userId);
    }

    const payload = {
      ...this.taskForm.value,
      startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      departmentIds,
      assignedToIds: finalAssigned,
    };

    this.isSubmitting = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.dueDateErrorMessage = null;
    this.startDateErrorMessage = null;

    this.taskService.createTask(payload).subscribe({
      next: (response: any) => {
        this.successMessage = response.message || 'Task created successfully!';
        this.isSubmitting = false;

        // Show success animation
        this.showSuccessAnimation();

        // Reset form after success
        setTimeout(() => {
          this.resetForm();
          // this.authApiService.goToDashboard();
        }, 2500);
      },
      error: (err: HttpErrorResponse) => {
        const backendMsg = err.error?.message;
        this.errorMessage = backendMsg
          ? backendMsg
          : 'Failed to create task. Please try again.';
        this.isSubmitting = false;
        
        // Scroll to error message
        setTimeout(() => {
          const errorEl = document.querySelector('.alert-danger');
          if (errorEl) {
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    });
  }

  private showSuccessAnimation(): void {
    const successEl = document.querySelector('.success-animation');
    if (successEl) {
      successEl.classList.add('active');
      setTimeout(() => successEl.classList.remove('active'), 2000);
    }
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
      recurrenceType: null,
      interval: 1,
      endDate: '',
    });
    this.selectedUsersByDeptObj = {};
    this.selectAllDepts = false;
    this.selectAllUsersByDept = {};
    this.deptSearch = '';
    this.userSearchByDept = {};
    this.filteredDepartments = [...this.departments];
    this.filteredUsersByDept.clear();
    this.dueDateErrorMessage = null;
    this.startDateErrorMessage = null;
    this.activeStep = 1;
    this.characterCount = 0;
  }

  cancel(): void {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      this.authApiService.goToDashboard();
    }
  }
hasDepartment(deptId: number): boolean {
  return this.departments?.some(d => d.departmentId === deptId) ?? false;
}

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.formSubscriptions.forEach(sub => sub.unsubscribe());
    window.removeEventListener('scroll', this.onScroll.bind(this));
  }
}