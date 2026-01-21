import { CommonModule } from '@angular/common';
import { 
  Component, 
  OnInit, 
  AfterViewInit, 
  ChangeDetectionStrategy,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  inject 
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  FormControl,
  AbstractControl,
  ValidationErrors,
  ValidatorFn
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
import { TitleCasePipe } from '@angular/common';
import * as bootstrap from 'bootstrap';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

type RecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface TaskFormControls {
  title: AbstractControl;
  description: AbstractControl;
  status: AbstractControl;
  startDate: AbstractControl;
  dueDate: AbstractControl;
  departmentIds: AbstractControl;
  assignedToIds: AbstractControl;
  assignToSelf: AbstractControl;
  isRecurring: AbstractControl;
  recurrenceType: AbstractControl;
  recurrenceInterval: AbstractControl;
  recurrenceEndDate: AbstractControl;
}
@Component({
  selector: 'app-add-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TitleCasePipe],
  templateUrl: './create-recurring-task-component.html',
  styleUrls: ['./create-recurring-task-component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateRecurringTaskComponent implements OnInit, AfterViewInit, OnDestroy {
  // Services
  private fb = inject(FormBuilder);
  private taskService = inject(TaskApiService);
  private departmentService = inject(DepartmentApiService);
  private userService = inject(UserApiService);
  private jwtService = inject(JwtService);
  private router = inject(Router);
  private authApiService = inject(AuthApiService);
  private cdr = inject(ChangeDetectorRef);
  
  // Form
  taskForm!: FormGroup;
  
  // State
  isLoadingDepartments = false;
  isLoadingUsers = false;
  isSubmitting = false;
  
  // Data
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  usersByDepartment: Map<number, userDto[]> = new Map();
  filteredUsersByDept: Map<number, userDto[]> = new Map();
  selectedUsersByDeptObj: Record<number, number[]> = {};
  statuses: TaskStatus[] = [TaskStatus.PENDING];
  currentUser: userDto | null = null;
  
  // Messages
  successMessage: string | null = null;
  errorMessage: string | null = null;
  dueDateErrorMessage: string | null = null;
  startDateErrorMessage: string | null = null;
  recurrenceIntervalError: string | null = null;
  
  // Search
  deptSearch = '';
  userSearchByDept: Record<number, string> = {};
  
  // Selection states
  selectAllDepts = false;
  selectAllUsersByDept: Record<number, boolean> = {};
  
  // UI state
  token = '';
  userId: number | null = null;
  minDate = new Date().toISOString().split('T')[0];
  recurrenceEndDateMin = this.minDate;
  
  // Modal
  private recurrenceModal?: bootstrap.Modal;
  
  // Form errors
  formErrors: string[] = [];
  
  // Preview
  recurrencePreview = '';
  
  // Destroy subject
  private destroy$ = new Subject<void>();
  
  // ViewChild
  @ViewChild('recurrenceModal') modalElement?: ElementRef;

  // Custom Validators
  private noSundayValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const date = new Date(control.value);
      if (date.getDay() === 0) {
        return { noSunday: true };
      }
      
      return null;
    };
  }
  
  private futureDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inputDate = new Date(control.value);
      inputDate.setHours(0, 0, 0, 0);
      
      if (inputDate < today) {
        return { pastDate: true };
      }
      
      return null;
    };
  }

  constructor() {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.setupFormListeners();
  }

  ngAfterViewInit(): void {
    const modalEl = document.getElementById('recurrenceModal');
  if (modalEl) {
    this.recurrenceModal = new bootstrap.Modal(modalEl, {
      backdrop: 'static',
      keyboard: false
    });
  }
    // this.initModal();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Form initialization
  private initForm(): void {
    this.taskForm = this.fb.group({
      title: ['', [
        Validators.required, 
        Validators.maxLength(255),
        Validators.minLength(3)
      ]],
      description: ['', [
        Validators.maxLength(2000)
      ]],
      status: [null, Validators.required],
      startDate: [''],
      dueDate: ['', [
        Validators.required,
        this.noSundayValidator(),
        this.futureDateValidator()
      ]],
      departmentIds: [[], [
        Validators.required,
        Validators.minLength(1)
      ]],
      assignedToIds: [[]],
      assignToSelf: [false],
      isRecurring: [false],
      recurrenceType: ['DAILY'],
      recurrenceInterval: [1, [
        Validators.required,
        Validators.min(1),
        Validators.max(365)
      ]],
      recurrenceEndDate: [''],
    });

    // Set initial validators for start date based on status
    this.updateStartDateValidators();
  }

  private setupFormListeners(): void {
    // Status changes
    this.taskForm.get('status')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((status: TaskStatus) => {
        this.updateStartDateValidators();
        this.validateDates();
        this.cdr.markForCheck();
      });

    // Date changes with debounce
    this.taskForm.get('startDate')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.validateDates();
        this.cdr.markForCheck();
      });

    this.taskForm.get('dueDate')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.validateDates();
        this.cdr.markForCheck();
      });

    // Assign to self changes
    this.taskForm.get('assignToSelf')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((assignToSelf: boolean) => {
        if (assignToSelf && this.currentUser) {
          this.assignToSelfLogic();
        } else {
          this.clearAssignToSelfLogic();
        }
        this.cdr.markForCheck();
      });

    // Recurring changes
    this.taskForm.get('isRecurring')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((isRecurring: boolean) => {
        if (isRecurring) {
          setTimeout(() => this.openRecurrenceModal(), 50);
        }
        this.updateRecurrencePreview();
        this.cdr.markForCheck();
      });

    // Recurrence interval changes
    this.taskForm.get('recurrenceInterval')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateRecurrencePreview();
        this.cdr.markForCheck();
      });

    this.taskForm.get('recurrenceType')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateRecurrencePreview();
        this.cdr.markForCheck();
      });

    this.taskForm.get('recurrenceEndDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateRecurrencePreview();
        this.cdr.markForCheck();
      });

    // Department changes
    this.taskForm.get('departmentIds')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((deptIds: number[]) => {
        this.updateSelectAllDepts();
        this.loadUsersForSelectedDepartments(deptIds);
        this.cdr.markForCheck();
      });
  }

  private updateStartDateValidators(): void {
    const startDateCtrl = this.taskForm.get('startDate');
    const status = this.taskForm.get('status')?.value;
    
    if (status === 'UPCOMING') {
      startDateCtrl?.setValidators([
        Validators.required,
        this.noSundayValidator(),
        this.futureDateValidator()
      ]);
    } else {
      startDateCtrl?.clearValidators();
    }
    
    startDateCtrl?.updateValueAndValidity();
  }

  // User loading
  private loadCurrentUser(): void {
    this.token = this.jwtService.getAccessToken() || '';
    this.userId = this.jwtService.getUserIdFromToken(this.token);
    
    if (this.userId) {
      this.userService.getUserById(this.userId).subscribe({
        next: (user) => {
          this.currentUser = user;
          this.loadDepartments();
        },
        error: (err) => {
          console.error('Failed to load current user:', err);
          this.loadDepartments();
        }
      });
    } else {
      this.loadDepartments();
    }
  }

  private loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.departmentService.getAllDepartments().subscribe({
      next: (departments) => {
        let filtered = departments;
        
        // Filter for HOD users
        if (this.currentUser?.role === 'HOD') {
          filtered = departments.filter(
            (dept) =>
              this.currentUser?.departmentIds?.includes(dept.departmentId) &&
              dept.name.toLowerCase() !== 'administration'
          );
        }
        
        this.departments = filtered;
        this.filteredDepartments = [...filtered];
        this.isLoadingDepartments = false;
        
        this.updateSelectAllDepts();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load departments:', err);
        this.errorMessage = 'Failed to load departments. Please try again.';
        this.isLoadingDepartments = false;
        this.cdr.markForCheck();
      }
    });
  }


private async loadUsersForSelectedDepartments(deptIds: number[]): Promise<void> {
  if (!deptIds?.length) return;

  this.isLoadingUsers = true;

  try {
    const loadPromises = deptIds.map(deptId =>
      firstValueFrom(this.userService.getAllUsersByDepartment(deptId))
    );
    const results = await Promise.all(loadPromises);
    results.forEach((users, index) => {
      const deptId = deptIds[index];

      if (users?.length) {
        const activeUsers = users.filter(u => u.status === 'ACTIVE');

        this.usersByDepartment.set(deptId, activeUsers);
        this.filteredUsersByDept.set(deptId, [...activeUsers]);
        this.userSearchByDept[deptId] = '';
      }
    });

  } catch (err) {
    console.error('Failed to load users:', err);
  } finally {
    this.isLoadingUsers = false;
    this.cdr.markForCheck();
  }
}


  // UI Helpers
  focusInput(event: MouseEvent, inputEl: HTMLInputElement): void {
    event.preventDefault();
    inputEl.focus();
    inputEl.showPicker?.();
  }

  // Department handling
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

  private updateSelectAllDepts(): void {
    const selected = this.taskForm.value.departmentIds;
    this.selectAllDepts =
      this.filteredDepartments.length > 0 &&
      this.filteredDepartments.every((d) => selected.includes(d.departmentId));
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
  }

  updateDepartmentSelection(deptId: number, checked: boolean): void {
    if (this.taskForm.value.assignToSelf) {
      return; // Block changes when assign to self is enabled
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

  // User handling
  onUserSearch(deptId: number): void {
    const query = (this.userSearchByDept[deptId] || '').toLowerCase().trim();
    const allUsers = this.usersByDepartment.get(deptId) || [];
    const filtered = allUsers.filter(
      (u) =>
        u.fullName.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
    this.filteredUsersByDept.set(deptId, filtered);
    this.updateSelectAllUsersForDept(deptId);
  }

  clearUserSearch(deptId: number): void {
    this.userSearchByDept[deptId] = '';
    this.onUserSearch(deptId);
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

  private updateSelectAllUsersForDept(deptId: number): void {
    const users = this.filteredUsersByDept.get(deptId) || [];
    const selected = this.selectedUsersByDeptObj[deptId] || [];
    const enabled = users.filter((u) => !this.isUserSelectionDisabled(u));
    this.selectAllUsersByDept[deptId] =
      enabled.length > 0 && enabled.every((u) => selected.includes(u.userId));
  }

  updateUserSelection(deptId: number, userId: number, checked: boolean): void {
    if (this.taskForm.value.assignToSelf && userId !== this.currentUser?.userId) {
      return; // Block changes when assign to self is enabled
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

  private updateAssignedToIds(): void {
    const all = Object.values(this.selectedUsersByDeptObj).flat();
    this.taskForm.patchValue({ assignedToIds: all });
  }

  // Assign to self logic
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
    myDeptIds.forEach(id => this.updateSelectAllUsersForDept(id));

    // Expand first accordion
    this.expandFirstAccordion();
  }

  private clearAssignToSelfLogic(): void {
    // Keep department selections but clear user selections
    this.selectedUsersByDeptObj = {};
    this.updateAssignedToIds();
    Object.keys(this.selectAllUsersByDept).forEach(key => {
      this.selectAllUsersByDept[+key] = false;
    });
  }

  private expandFirstAccordion(): void {
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

  toggleAccordion(deptId: number): void {
    const el = document.getElementById(`collapse-${deptId}`);
    if (el) {
      el.classList.toggle('show');
    }
  }

  // Date validation
  validateDates(): void {
    const startDate = this.taskForm.value.startDate;
    const dueDate = this.taskForm.value.dueDate;
    const status = this.taskForm.value.status;

    this.dueDateErrorMessage = null;
    this.startDateErrorMessage = null;

    if (!dueDate) {
      this.dueDateErrorMessage = 'Due date is required.';
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(startDate) : today;
    start.setHours(0, 0, 0, 0);


    // Check if due date is before start date
    if (due < start) {
      this.dueDateErrorMessage = 'Due date must be on or after start date.';
    }

    // Status-specific validations
    if (status === 'PENDING') {
      if (due < today) {
        this.dueDateErrorMessage = 'For PENDING status, due date cannot be in the past.';
      }
    }

    if (status === 'UPCOMING') {
      if (!startDate) {
        this.startDateErrorMessage = 'Start date is required for UPCOMING status.';
      } else if (start <= today) {
        this.startDateErrorMessage = 'For UPCOMING status, start date must be in the future.';
      }
    }

    // Update form validity
    if (this.dueDateErrorMessage) {
      this.taskForm.get('dueDate')?.setErrors({ custom: true });
    } else {
      this.taskForm.get('dueDate')?.setErrors(null);
    }

    if (this.startDateErrorMessage) {
      this.taskForm.get('startDate')?.setErrors({ custom: true });
    } else {
      this.taskForm.get('startDate')?.setErrors(null);
    }
  }

  onStartDateChange(): void {
    this.validateDates();
  }

  onDueDateChange(): void {
    this.validateDates();
  }

  // Form getters
  get f(): TaskFormControls {
    return {
      title: this.taskForm.get('title')!,
      description: this.taskForm.get('description')!,
      status: this.taskForm.get('status')!,
      startDate: this.taskForm.get('startDate')!,
      dueDate: this.taskForm.get('dueDate')!,
      departmentIds: this.taskForm.get('departmentIds')!,
      assignedToIds: this.taskForm.get('assignedToIds')!,
      assignToSelf: this.taskForm.get('assignToSelf')!,
      isRecurring: this.taskForm.get('isRecurring')!,
      recurrenceType: this.taskForm.get('recurrenceType')!,
      recurrenceInterval: this.taskForm.get('recurrenceInterval')!,
      recurrenceEndDate: this.taskForm.get('recurrenceEndDate')!,
    };
  }

  get dueDateCtrl(): FormControl {
    return this.taskForm.get('dueDate') as FormControl;
  }

  get startDateCtrl(): FormControl {
    return this.taskForm.get('startDate') as FormControl;
  }

  // User permission checks
  isUserSelectionDisabled(user: userDto): boolean {
    if (!this.currentUser) return true;
    
    switch (this.currentUser.role) {
      case 'ADMIN':
        return false;
      case 'HOD':
        const isSelf = user.userId === this.currentUser.userId;
        const sameDept = user.departmentIds?.some(id =>
          this.currentUser?.departmentIds?.includes(id)
        );
        return !(isSelf || sameDept);
      default:
        return true;
    }
  }

  getDepartmentName(id: number): string {
    return this.departments.find(d => d.departmentId === id)?.name || `Department ${id}`;
  }

  getDepartmentNames(deptIds: number[]): string {
    if (!deptIds?.length) return '';
    return deptIds
      .map(id => this.departments.find(d => d.departmentId === id)?.name)
      .filter(Boolean)
      .join(', ');
  }

  // Recurrence Modal
  private initModal(): void {
    if (this.modalElement) {
      this.recurrenceModal = new bootstrap.Modal(this.modalElement.nativeElement, {
        backdrop: 'static',
        keyboard: false,
      });
    }
  }

  openRecurrenceModal(): void {
    console.log('Opening recurrence modal');
    if (this.recurrenceModal) {
      console.log('Showing recurrence modal');
      this.recurrenceModal.show();
      this.updateRecurrencePreview();
    }
  }

  closeRecurrenceModal(): void {
    console.log('Closing recurrence modal');
    if (this.recurrenceModal) {
      console.log('Hiding recurrence modal');
      this.recurrenceModal.hide();
    }
  }

  onRecurrenceIntervalChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const numValue = parseInt(value, 10);
    
    if (isNaN(numValue) || numValue < 1) {
      this.recurrenceIntervalError = 'Interval must be at least 1';
      this.taskForm.get('recurrenceInterval')?.setErrors({ min: true });
    } else if (numValue > 365) {
      this.recurrenceIntervalError = 'Interval cannot exceed 365';
      this.taskForm.get('recurrenceInterval')?.setErrors({ max: true });
    } else {
      this.recurrenceIntervalError = null;
      this.taskForm.get('recurrenceInterval')?.setErrors(null);
    }
    
    this.updateRecurrencePreview();
  }

  onRecurrenceTypeChange(): void {
    this.updateRecurrencePreview();
  }

  onRecurrenceEndDateChange(): void {
    this.updateRecurrencePreview();
  }

  saveRecurrenceSettings(): void {
    if (this.recurrenceIntervalError) {
      return;
    }
    
    this.closeRecurrenceModal();
  }

  private updateRecurrencePreview(): void {
    const interval = this.taskForm.value.recurrenceInterval || 1;
    const type = (this.taskForm.value.recurrenceType || 'DAILY') as RecurrenceType;
    const endDate = this.taskForm.value.recurrenceEndDate;
    
    const typeMap: Record<RecurrenceType, string> = {
      DAILY: interval === 1 ? 'day' : 'days',
      WEEKLY: interval === 1 ? 'week' : 'weeks',
      MONTHLY: interval === 1 ? 'month' : 'months'
    };
    
    let preview = `Repeats every ${interval} ${typeMap[type]}`;
    
    if (endDate) {
      const endDateStr = new Date(endDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      preview += ` until ${endDateStr}`;
    } else {
      preview += ' indefinitely';
    }
    
    this.recurrencePreview = preview;
  }

  // Form submission
  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.markFormAsTouched();
      this.collectFormErrors();
      this.errorMessage = 'Please fix the errors in the form before submitting.';
      return;
    }

    this.validateDates();
    if (this.dueDateErrorMessage || this.startDateErrorMessage) {
      this.errorMessage = 'Please fix date errors before submitting.';
      return;
    }

    const formValue = this.taskForm.value;
    const finalAssigned = [...(formValue.assignedToIds || [])];
    
    // Add current user if assign to self is checked
    if (formValue.assignToSelf && this.currentUser) {
      if (!finalAssigned.includes(this.currentUser.userId)) {
        finalAssigned.push(this.currentUser.userId);
      }
    }

    // Prepare payload
    const payload: any = {
      title: formValue.title,
      description: formValue.description || '',
      status: formValue.status,
      startDate: formValue.startDate 
        ? new Date(formValue.startDate).toISOString()
        : new Date().toISOString(),
      dueDate: new Date(formValue.dueDate).toISOString(),
      departmentIds: formValue.departmentIds,
      assignedToIds: finalAssigned,
      assignToSelf: formValue.assignToSelf,
    };

    // Add recurrence data if enabled
    if (formValue.isRecurring) {
      console.log('Adding recurrence data to payload');
      payload.recurrenceType = formValue.recurrenceType;
      payload.recurrenceInterval = Number(formValue.recurrenceInterval) || 1;
      payload.isRecurring = true;
      
      if (formValue.recurrenceEndDate) {
        payload.recurrenceEndDate = new Date(formValue.recurrenceEndDate).toISOString();
      }
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    
    this.taskService.createTask(payload).subscribe({
      next: (response) => {
        this.successMessage = 'Task created successfully!';
        this.isSubmitting = false;
        
        setTimeout(() => {
          this.resetForm();
          // this.authApiService.goToDashboard();
        }, 1500);
        
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.isSubmitting = false;
        
        if (err.status === 400) {
          this.errorMessage = err.error?.message || 'Invalid data. Please check your inputs.';
        } else if (err.status === 401) {
          this.errorMessage = 'Your session has expired. Please login again.';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else if (err.status === 403) {
          this.errorMessage = 'You do not have permission to create tasks.';
        } else if (err.status === 409) {
          this.errorMessage = 'A similar task already exists.';
        } else {
          this.errorMessage = err.error?.message || 'Failed to create task. Please try again.';
        }
        
        this.cdr.markForCheck();
      }
    });
  }

  private markFormAsTouched(): void {
    Object.values(this.taskForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  private collectFormErrors(): void {
    this.formErrors = [];
    
    if (this.taskForm.get('title')?.errors) {
      this.formErrors.push('Task title is required (3-255 characters)');
    }
    
    if (this.taskForm.get('status')?.errors) {
      this.formErrors.push('Status is required');
    }
    
    if (this.taskForm.get('dueDate')?.errors) {
      this.formErrors.push('Valid due date is required');
    }
    
    if (this.taskForm.get('departmentIds')?.errors) {
      this.formErrors.push('At least one department must be selected');
    }
    
    if (this.startDateErrorMessage) {
      this.formErrors.push(this.startDateErrorMessage);
    }
    
    if (this.dueDateErrorMessage) {
      this.formErrors.push(this.dueDateErrorMessage);
    }
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
    
    this.selectedUsersByDeptObj = {};
    this.userSearchByDept = {};
    this.deptSearch = '';
    this.selectAllDepts = false;
    this.selectAllUsersByDept = {};
    this.formErrors = [];
    this.successMessage = null;
    this.errorMessage = null;
    this.dueDateErrorMessage = null;
    this.startDateErrorMessage = null;
    
    this.updateSelectAllDepts();
    this.cdr.markForCheck();
  }

  cancel(): void {
    if (this.taskForm.dirty) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        this.authApiService.goToDashboard();
      }
    } else {
      this.authApiService.goToDashboard();
    }
  }
}