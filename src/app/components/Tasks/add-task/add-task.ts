import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy, AfterViewInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
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
import { TaskTemplateApiService, TaskTemplateDto, TaskTemplateCategoryDto } from '../../../Services/task-template-api.service';

interface TaskFormControls {
  title: any;
  description: any;
  status: any;
  startDate: any;
  dueDate: any;
  departmentIds: any;
  assignedToIds: any;
  assignToSelf: any;
  subDepartmentId: any;
}

@Component({
  selector: 'app-add-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './add-task.html',
  styleUrls: ['./add-task.css'],
})


export class AddTaskComponent implements OnInit, AfterViewInit {
  @Input() isModal = false;
  @Output() closed = new EventEmitter<boolean>();
  taskForm!: FormGroup;
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  usersByDepartment: Map<number, userDto[]> = new Map();
  filteredUsersByDept: Map<number, userDto[]> = new Map();
  selectedUsersByDeptObj: Record<number, number[]> = {};
  statuses = ["UPCOMING", "PENDING"];
  currentUser: userDto | null = null;
  allUsers: userDto[] = [];
  filteredAllUsers: userDto[] = [];
  superAdminUserSearch = '';
  subDepartments: any[] = [];
  filteredSubDepartments: any[] = [];

  // Template States
  categories: TaskTemplateCategoryDto[] = [];
  templates: TaskTemplateDto[] = [];
  filteredTemplates: TaskTemplateDto[] = [];
  selectedTemplate: TaskTemplateDto | null = null;

  // UI States
  isSubmitting = false;
  isLoadingDepartments = false;
  isLoadingUsers = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  dueDateErrorMessage: string | null = null;
  startDateErrorMessage: string | null = null;
  
  // Dropdown UI States
  isOpenDepts = false;
  isOpenUsers = false;
  userFilterQuery = '';

  // Search
  deptSearch = '';
  userSearchByDept: Record<number, string> = {};

  // Select All
  selectAllDepts = false;
  selectAllUsersByDept: Record<number, boolean> = {};

  token = '';
  userId: number | null = null;
  minDate = new Date().toISOString().split('T')[0];

  constructor(
    private fb: FormBuilder,
    private taskService: TaskApiService,
    private departmentService: DepartmentApiService,
    private userService: UserApiService,
    private jwtService: JwtService,
    private router: Router,
    private authApiService: AuthApiService,
    private templateApiService: TaskTemplateApiService
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
          if (this.currentUser?.role === 'SUPER_ADMIN') {
            this.taskForm.get('departmentIds')?.clearValidators();
            this.taskForm.get('departmentIds')?.updateValueAndValidity();
          }
          this.loadDepartments();
        },
        // ... error ...
      });
    } else {
      this.loadDepartments();
    }

    this.departmentService.getAllSubDepartments().subscribe({
      next: (subs) => {
        this.subDepartments = subs;
        this.filterSubDepartments();
      },
      error: (err) => {
        console.error('Failed to load sub-departments', err);
      }
    });

    // NEW: Listen to "Assign to Self"
    this.taskForm.get('assignToSelf')?.valueChanges.subscribe((assignToSelf) => {
      if (assignToSelf && this.currentUser) {
        this.assignToSelfLogic();
      } else {
        this.clearAssignToSelfLogic();
      }
    });

    // Load templates and categories
    this.templateApiService.getAllCategories().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.categories = res.data.filter(c => c.isActive !== false);
        }
      },
      error: (err) => console.error('Failed to load categories', err)
    });

    this.templateApiService.getAllTemplates().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.templates = res.data.filter(t => t.isActive !== false);
        }
      },
      error: (err) => console.error('Failed to load templates', err)
    });
  }

  private assignToSelfLogic(): void {
    if (!this.currentUser) return;

    const myDeptIds = this.currentUser.departmentIds || [];
    const myUserId = this.currentUser.userId;

    // 1. Auto-select my departments
    this.taskForm.patchValue({ departmentIds: myDeptIds });

    // Auto-select my sub-department if set
    if (this.currentUser.subDepartmentId) {
      this.taskForm.patchValue({ subDepartmentId: this.currentUser.subDepartmentId });
    }

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

  ngAfterViewInit(): void {
    // Focus search after view init
    setTimeout(() => {
      const searchInput = document.querySelector('#dept-search') as HTMLInputElement;
      searchInput?.focus();
    }, 300);
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
      subDepartmentId: [null],
      isTemplateTask: [false],
      templateCategoryId: [null],
      templateId: [null],
      targetCount: [null],
      targetPercentage: [null]
    });

    this.taskForm.get('departmentIds')?.valueChanges.subscribe(() => {
      this.updateFilteredUsers();
      this.expandFirstAccordion();
      this.filterSubDepartments();
    });

    this.taskForm.get('status')?.valueChanges.subscribe(() => {
      if (this.taskForm.value.status !== 'UPCOMING') {
        this.taskForm.patchValue({ startDate: '' });
      }
    });

    this.taskForm.get('isTemplateTask')?.valueChanges.subscribe((isTemplate) => {
      const titleCtrl = this.taskForm.get('title');
      const descCtrl = this.taskForm.get('description');
      const catCtrl = this.taskForm.get('templateCategoryId');
      const tempCtrl = this.taskForm.get('templateId');

      if (isTemplate) {
        catCtrl?.setValidators([Validators.required]);
        tempCtrl?.setValidators([Validators.required]);
        titleCtrl?.clearValidators();
      } else {
        catCtrl?.clearValidators();
        tempCtrl?.clearValidators();
        catCtrl?.setValue(null);
        tempCtrl?.setValue(null);
        this.selectedTemplate = null;
        
        titleCtrl?.setValidators([Validators.required, Validators.maxLength(255)]);
        titleCtrl?.enable();
        descCtrl?.enable();
        titleCtrl?.setValue('');
        descCtrl?.setValue('');
      }
      catCtrl?.updateValueAndValidity();
      tempCtrl?.updateValueAndValidity();
      titleCtrl?.updateValueAndValidity();
      descCtrl?.updateValueAndValidity();
      this.updateTemplateValidation();
    });

    this.taskForm.get('templateCategoryId')?.valueChanges.subscribe((catId) => {
      this.taskForm.get('templateId')?.setValue(null);
      this.selectedTemplate = null;
      if (catId) {
        this.filteredTemplates = this.templates.filter(t => t.category.id === +catId);
      } else {
        this.filteredTemplates = [];
      }
      this.updateTemplateValidation();
    });

    this.taskForm.get('templateId')?.valueChanges.subscribe((tempId) => {
      this.selectedTemplate = null;
      const titleCtrl = this.taskForm.get('title');
      const descCtrl = this.taskForm.get('description');

      if (tempId) {
        const template = this.templates.find(t => t.id === +tempId);
        if (template) {
          this.selectedTemplate = template;
          if (template.title === 'Others') {
            titleCtrl?.enable();
            descCtrl?.enable();
            titleCtrl?.setValue('');
            descCtrl?.setValue('');
            titleCtrl?.setValidators([Validators.required, Validators.maxLength(255)]);
          } else {
            titleCtrl?.setValue(template.title);
            descCtrl?.setValue(template.description);
            titleCtrl?.disable();
            descCtrl?.enable();
          }
        }
      } else {
        titleCtrl?.setValue('');
        descCtrl?.setValue('');
        titleCtrl?.enable();
        descCtrl?.enable();
      }
      titleCtrl?.updateValueAndValidity();
      descCtrl?.updateValueAndValidity();
      this.updateTemplateValidation();
    });
  }

  getProgressOptions(): string[] {
    const field = this.selectedTemplate?.fields?.find(f => f.fieldType === 'DROPDOWN');
    return field?.options ? field.options.split(',') : [];
  }

  updateTemplateValidation(): void {
    const countCtrl = this.taskForm.get('targetCount');
    const percentCtrl = this.taskForm.get('targetPercentage');

    countCtrl?.clearValidators();
    percentCtrl?.clearValidators();

    if (this.taskForm.value.isTemplateTask && this.selectedTemplate) {
      const hasNumberField = this.selectedTemplate.fields?.some(f => f.fieldType === 'NUMBER' && f.fieldName?.toLowerCase() === 'count');
      const hasDropdownField = this.selectedTemplate.fields?.some(f => f.fieldType === 'DROPDOWN' && f.fieldName?.toLowerCase() === 'progress');

      if (hasNumberField) {
        countCtrl?.setValidators([Validators.required, Validators.min(1)]);
      }
      if (hasDropdownField) {
        percentCtrl?.setValidators([Validators.required]);
      }
    } else {
      countCtrl?.setValue(null);
      percentCtrl?.setValue(null);
    }

    countCtrl?.updateValueAndValidity();
    percentCtrl?.updateValueAndValidity();
  }

  filterSubDepartments(): void {
    const selectedDeptIds = this.taskForm.value.departmentIds || [];
    const isSuperAdmin = this.currentUser?.role === 'SUPER_ADMIN';
    if (!selectedDeptIds.length) {
      if (isSuperAdmin) {
        this.filteredSubDepartments = [...this.subDepartments];
      } else {
        this.filteredSubDepartments = [];
        this.taskForm.get('subDepartmentId')?.setValue(null);
      }
      return;
    }
    this.filteredSubDepartments = this.subDepartments.filter(sub => {
      const deptId = sub.department?.departmentId;
      return deptId && selectedDeptIds.includes(deptId);
    });

    const currentSubId = this.taskForm.value.subDepartmentId;
    if (currentSubId && !this.filteredSubDepartments.some(sub => sub.id === currentSubId)) {
      this.taskForm.get('subDepartmentId')?.setValue(null);
    }
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
        this.allUsers = activeUsers;
        this.filteredAllUsers = activeUsers.filter(u => u.userId !== this.currentUser?.userId);

        this.usersByDepartment.clear();
        this.filteredUsersByDept.clear();

        for (const dept of this.departments) {
          const usersInDept = activeUsers
            .filter((u) => u.departmentIds?.includes(dept.departmentId))
            .filter((u) => {
              if (!this.currentUser) return false;
              const currentRole = this.currentUser.role;
              if (currentRole === 'SUPER_ADMIN') {
                return true; // SUPER_ADMIN can see everyone
              }
              // Allow seeing self (so they can assign to self if they want) or users below them
              return u.userId === this.currentUser.userId || this.isUserBelow(u, this.currentUser);
            })
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

      const selectedUser = this.allUsers.find(u => u.userId === userId);
      if (selectedUser) {
        const currentDeptIds = [...(this.taskForm.value.departmentIds || [])];
        let changed = false;
        selectedUser.departmentIds?.forEach(id => {
          if (!currentDeptIds.includes(id)) {
            currentDeptIds.push(id);
            changed = true;
          }
        });
        if (changed) {
          this.taskForm.patchValue({ departmentIds: currentDeptIds });
        }

        if (selectedUser.subDepartmentId && !this.taskForm.value.subDepartmentId) {
          this.taskForm.patchValue({ subDepartmentId: selectedUser.subDepartmentId });
        }
      }
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

  isUserBelow(child: userDto, parent: userDto): boolean {
    if (!child || !parent) return false;
    let currentParentId = child.parentUserId;
    const visited = new Set<number>();
    while (currentParentId) {
      if (currentParentId === parent.userId) {
        return true;
      }
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);
      const parentUser = this.allUsers.find(u => u.userId === currentParentId);
      currentParentId = parentUser?.parentUserId;
    }
    return false;
  }

  isUserSelectionDisabled(user: userDto): boolean {
    if (!this.currentUser) return true;

    // Allow self assignment
    if (user.userId === this.currentUser.userId) {
      return false;
    }

    // Block parent assignment
    if (this.isUserBelow(this.currentUser, user)) {
      return true;
    }

    const currentRole = this.currentUser.role;
    const targetRole = user.role;

    if (currentRole === 'SUPER_ADMIN') {
      return false; // Can assign to anyone
    }

    if (currentRole === 'ADMIN') {
      // Admin should only see/assign users below him
      if (targetRole === 'SUPER_ADMIN' || targetRole === 'ADMIN') {
        return true;
      }
      return !this.isUserBelow(user, this.currentUser);
    }

    if (currentRole === 'SUB_ADMIN') {
      // SubAdmin can assign tasks to HODs and Teachers under his hierarchy
      if (targetRole !== 'HOD' && targetRole !== 'TEACHER') {
        return true;
      }
      return !this.isUserBelow(user, this.currentUser);
    }

    if (currentRole === 'HOD') {
      // HOD can assign tasks to Teachers belonging to their department and hierarchy
      if (targetRole !== 'TEACHER') {
        return true;
      }
      const sameDept = user.departmentIds?.some((id) =>
        this.currentUser?.departmentIds?.includes(id)
      );
      const isDescendant = this.isUserBelow(user, this.currentUser);
      return !(sameDept && isDescendant);
    }

    return true;
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
  focusInput(event: MouseEvent, inputEl: HTMLInputElement): void {
    // Prevent the click from bubbling to the native picker twice
    event.preventDefault();
    inputEl.focus();
    // For some browsers you also need to programmatically open the picker:
    inputEl.showPicker?.();   // Chrome/Edge/Firefox (2025+)
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
    return this.departments.find((d) => d.departmentId === id)?.name || `Dept ${id}`;
  }

  onSuperAdminUserSearch(): void {
    const query = this.superAdminUserSearch.toLowerCase().trim();
    this.filteredAllUsers = this.allUsers.filter(u =>
      (u.fullName.toLowerCase().includes(query) || u.username.toLowerCase().includes(query)) &&
      u.userId !== this.currentUser?.userId
    );
  }

  clearSuperAdminUserSearch(): void {
    this.superAdminUserSearch = '';
    this.onSuperAdminUserSearch();
  }

  updateSuperAdminUserSelection(userId: number, checked: boolean): void {
    let currentAssigned = [...(this.taskForm.value.assignedToIds || [])];
    if (checked) {
      if (!currentAssigned.includes(userId)) {
        currentAssigned.push(userId);
      }
      
      const selectedUser = this.allUsers.find(u => u.userId === userId);
      if (selectedUser) {
        const currentDeptIds = [...(this.taskForm.value.departmentIds || [])];
        let changed = false;
        selectedUser.departmentIds?.forEach(id => {
          if (!currentDeptIds.includes(id)) {
            currentDeptIds.push(id);
            changed = true;
          }
        });
        if (changed) {
          this.taskForm.patchValue({ departmentIds: currentDeptIds });
        }

        if (selectedUser.subDepartmentId && !this.taskForm.value.subDepartmentId) {
          this.taskForm.patchValue({ subDepartmentId: selectedUser.subDepartmentId });
        }
      }
    } else {
      currentAssigned = currentAssigned.filter(id => id !== userId);
    }
    this.taskForm.patchValue({ assignedToIds: currentAssigned });
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.errorMessage = 'Please fill all required fields correctly.';
      this.taskForm.markAllAsTouched();
      return;
    }

    const rawForm = this.taskForm.getRawValue();
    const { startDate, dueDate, departmentIds, assignedToIds, assignToSelf, status, subDepartmentId, isTemplateTask, templateId, targetCount, targetPercentage } = rawForm;

    // === CLIENT-SIDE DATE VALIDATION (must match backend) ===
    const dateValidation = this.validateDatesClientSide(startDate, dueDate, status);
    if (!dateValidation.valid) {
      this.dueDateErrorMessage = dateValidation.msg!;
      return;
    }

    const isSuperAdmin = this.currentUser?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !departmentIds?.length) {
      this.errorMessage = 'Please select at least one department.';
      return;
    }

    const finalAssigned = [...assignedToIds];
    if (assignToSelf && this.currentUser && !finalAssigned.includes(this.currentUser.userId)) {
      finalAssigned.push(this.currentUser.userId);
    }

    let targetPercentageVal = null;
    if (targetPercentage) {
      const rawPct = targetPercentage.toString();
      targetPercentageVal = parseFloat(rawPct.replace('%', ''));
    }

    const payload = {
      title: rawForm.title,
      description: rawForm.description,
      status: status,
      startDate: startDate || null,
      dueDate: dueDate,      
      departmentIds: departmentIds || [],
      assignedToIds: finalAssigned,
      subDepartmentId: subDepartmentId || null,
      templateId: isTemplateTask ? +templateId : null,
      targetCount: (isTemplateTask && targetCount) ? +targetCount : null,
      targetPercentage: (isTemplateTask && targetPercentageVal) ? targetPercentageVal : null
    };

    this.isSubmitting = true;
    this.successMessage = null;
    this.errorMessage = null;
    this.dueDateErrorMessage = null;
    this.startDateErrorMessage = null;
    console.log(payload);
    this.taskService.createTask(payload).subscribe({
      next: (response: ApiResponse<TaskDto>) => {
        this.successMessage = response.message || 'Task created successfully!';
        this.isSubmitting = false;
        setTimeout(() => {
          if (this.isModal) {
            this.closed.emit(true);
          } else {
            this.authApiService.goToDashboard();
          }
        }, 1500);

        setTimeout(() => {
          // this.resetForm();
          // this.authApiService.goToDashboard();
        }, 1500);
      },
      error: (err: HttpErrorResponse) => {
        const backendMsg = err.error?.message;
        this.errorMessage = backendMsg
          ? backendMsg
          : 'Failed to create task. Please try again.';
        this.isSubmitting = false;
      }
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
    // if (startOnly.getDay() === 0) return { valid: false, msg: 'Start date cannot be on Sunday' };
    // if (dueOnly.getDay() === 0) return { valid: false, msg: 'Due date cannot be on Sunday' };

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
      isTemplateTask: false,
      templateCategoryId: null,
      templateId: null,
      targetCount: null,
      targetPercentage: null,
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
  }

  get hasCountField(): boolean {
    return !!(this.taskForm.value.isTemplateTask && this.selectedTemplate?.fields?.some(f => f.fieldType === 'NUMBER' && f.fieldName?.toLowerCase() === 'count'));
  }

  get hasProgressField(): boolean {
    return !!(this.taskForm.value.isTemplateTask && this.selectedTemplate?.fields?.some(f => f.fieldType === 'DROPDOWN' && f.fieldName?.toLowerCase() === 'progress'));
  }

  getUserFullName(userId: number): string {
    return this.allUsers.find(u => u.userId === userId)?.fullName || `User ${userId}`;
  }

  removeUser(userId: number): void {
    const selectedDepts = this.taskForm.value.departmentIds || [];
    selectedDepts.forEach((deptId: number) => {
      this.updateUserSelection(deptId, userId, false);
    });
    this.updateSuperAdminUserSelection(userId, false);
  }

  getFilteredUsersForDept(deptId: number): userDto[] {
    const users = this.usersByDepartment.get(deptId) || [];
    if (!this.userFilterQuery) return users;
    const query = this.userFilterQuery.toLowerCase().trim();
    return users.filter(u => u.fullName.toLowerCase().includes(query) || u.username.toLowerCase().includes(query));
  }

  getFilteredAllUsers(): userDto[] {
    if (!this.userFilterQuery) return this.filteredAllUsers;
    const query = this.userFilterQuery.toLowerCase().trim();
    return this.filteredAllUsers.filter(u => u.fullName.toLowerCase().includes(query) || u.username.toLowerCase().includes(query));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dept-select-container')) {
      this.isOpenDepts = false;
    }
    if (!target.closest('.user-select-container')) {
      this.isOpenUsers = false;
    }
  }

  cancel(): void {
    if (this.isModal) {
      this.closed.emit(false);
    } else {
      this.authApiService.goToDashboard();
    }
  }
}