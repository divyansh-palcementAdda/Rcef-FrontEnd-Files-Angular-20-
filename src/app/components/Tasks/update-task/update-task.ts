import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  Output,
  EventEmitter,
  HostListener,
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
  isTemplateTask: any;
  templateCategoryId: any;
  templateId: any;
  targetCount: any;
  targetPercentage: any;
}

@Component({
  selector: 'app-update-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './update-task.html',
  styleUrls: ['./update-task.css'],
})
export class UpdateTaskComponent implements OnInit, AfterViewInit {
  @Input() isModal = false;
  @Output() closed = new EventEmitter<boolean>();
  /* ---------- FORM ---------- */
  taskForm!: FormGroup;
  taskId!: number;

  /* ---------- DATA ---------- */
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  usersByDepartment = new Map<number, userDto[]>();
  filteredUsersByDept = new Map<number, userDto[]>();
  selectedUsersByDeptObj: Record<number, number[]> = {};
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

  allowedStatuses: TaskStatus[] = [
    TaskStatus.PENDING,
    TaskStatus.UPCOMING,
    TaskStatus.CLOSED,
    TaskStatus.DELAYED,
  ];

  statuses = [...this.allowedStatuses];

  currentUser: userDto | null = null;
  isFormInitializing = false;

  /* ---------- UI STATE ---------- */
  isSubmitting = false;
  isLoadingTask = false;
  isLoadingDepartments = false;
  isLoadingUsers = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;
  dateErrorMessage: string | null = null;

  // Dropdown UI States
  isOpenDepts = false;
  isOpenUsers = false;
  userFilterQuery = '';

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
    private templateApiService: TaskTemplateApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.initForm();
  }

  /* ---------- GETTERS ---------- */
  get f() { return this.taskForm.controls as unknown as TaskFormControls; }
  get dueDateCtrl() { return this.taskForm.get('dueDate') as FormControl; }
  get startDateCtrl() { return this.taskForm.get('startDate') as FormControl; }

  get hasCountField(): boolean {
    return !!(this.taskForm.value.isTemplateTask && this.selectedTemplate?.fields?.some(f => f.fieldType === 'NUMBER' && f.fieldName?.toLowerCase() === 'count'));
  }

  get hasProgressField(): boolean {
    return !!(this.taskForm.value.isTemplateTask && this.selectedTemplate?.fields?.some(f => f.fieldType === 'DROPDOWN' && f.fieldName?.toLowerCase() === 'progress'));
  }

  /* ---------- LIFECYCLE ---------- */
  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.taskId = +params['taskId'];
    if (!this.taskId || isNaN(this.taskId)) {
      this.errorMessage = 'Invalid task ID.';
      if (!this.isModal) {
        this.router.navigate(['/view-tasks']);
      }
      return;
    }
    this.loadCurrentUserAndTask();

    this.taskForm.get('assignToSelf')?.valueChanges.subscribe((v) => {
      if (v && this.currentUser) this.assignToSelfLogic();
      else this.clearAssignToSelfLogic();
      this.cdr.markForCheck();
    });

    // Load templates and categories
    this.templateApiService.getAllCategories().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.categories = res.data.filter(c => c.isActive !== false);
          this.cdr.markForCheck();
        }
      },
      error: (err) => console.error('Failed to load categories', err)
    });

    this.templateApiService.getAllTemplates().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.templates = res.data.filter(t => t.isActive !== false);
          this.cdr.markForCheck();
        }
      },
      error: (err) => console.error('Failed to load templates', err)
    });

    this.departmentService.getAllSubDepartments().subscribe({
      next: (subs) => {
        this.subDepartments = subs;
        this.filterSubDepartments();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load sub-departments', err);
      }
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
      this.cdr.markForCheck();
    });

    this.taskForm.get('status')?.valueChanges.subscribe((s) => {
      if (s !== 'UPCOMING') {
        this.taskForm.patchValue({ startDate: '' });
        this.cdr.markForCheck();
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
        // Keep existing title/description when switching to template mode
        // They will be updated when a template is selected
      } else {
        catCtrl?.clearValidators();
        tempCtrl?.clearValidators();
        catCtrl?.setValue(null);
        tempCtrl?.setValue(null);
        this.selectedTemplate = null;
        
        titleCtrl?.setValidators([Validators.required, Validators.maxLength(255)]);
        titleCtrl?.enable();
        descCtrl?.enable();
        if (!this.isFormInitializing) {
          titleCtrl?.setValue('');
          descCtrl?.setValue('');
        }
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
          } else {
            if (!this.isFormInitializing) {
              titleCtrl?.setValue(template.title);
              descCtrl?.setValue(template.description);
            }
            titleCtrl?.disable();
            descCtrl?.enable();
          }
        }
      } else {
        // Only clear title/description if not during initialization and not switching modes
        if (!this.isFormInitializing && this.taskForm.value.isTemplateTask === false) {
          titleCtrl?.setValue('');
          descCtrl?.setValue('');
        }
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

  /* ---------- HELPER: Local Date Formatting ---------- */
  private formatDateForInput(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /* ---------- LOAD USER + TASK ---------- */
  private loadCurrentUserAndTask(): void {
    this.isLoadingTask = true;
    this.isFormInitializing = true;
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
          console.log('Loaded Task:', res.data);
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
    const start = this.formatDateForInput(task.startDate);
    const due = this.formatDateForInput(task.dueDate);

    // Populate template info if it's template task
    const isTemplate = !!task.template;
    const templateId = task.template?.id ?? null;
    const templateCategoryId = task.template?.category?.id ?? null;

    // Always populate form first with basic values
    this.setFormValuesAndChecks(task, start, due, isTemplate, templateCategoryId, templateId);

    if (templateId) {
      const t = this.templates.find(temp => temp.id === templateId);
      if (t) {
        this.selectedTemplate = t;
        this.filteredTemplates = this.templates.filter(temp => temp.category.id === templateCategoryId);
        this.updateTemplateValidation();
      } else {
        this.templateApiService.getAllTemplates().subscribe({
          next: (res) => {
            if (res.success && res.data) {
              this.templates = res.data.filter(temp => temp.isActive !== false);
              const found = this.templates.find(temp => temp.id === templateId);
              if (found) {
                this.selectedTemplate = found;
                this.filteredTemplates = this.templates.filter(temp => temp.category.id === templateCategoryId);
                this.updateTemplateValidation();
              }
            }
          }
        });
      }
    }
  }

  private setFormValuesAndChecks(task: TaskDto, start: string, due: string, isTemplate: boolean, templateCategoryId: number | null, templateId: number | null): void {
    this.taskForm.patchValue({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      startDate: start,
      dueDate: due,
      departmentIds: task.departmentIds ?? [],
      subDepartmentId: task.subDepartmentId ?? null,
      isTemplateTask: isTemplate,
      templateCategoryId: templateCategoryId,
      templateId: templateId,
      targetCount: task.targetCount ?? null,
      targetPercentage: task.targetPercentage ? `${task.targetPercentage}%` : null
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

    const titleCtrl = this.taskForm.get('title');
    const descCtrl = this.taskForm.get('description');
    if (isTemplate && this.selectedTemplate && this.selectedTemplate.title !== 'Others') {
      titleCtrl?.disable();
      descCtrl?.enable();
    } else {
      titleCtrl?.enable();
      descCtrl?.enable();
    }

    this.dateErrorMessage = null;
    this.filterSubDepartments();
    this.isFormInitializing = false;
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
      next: (res) => {
        const active = res.filter((u) => u.status === 'ACTIVE');
        this.allUsers = active;
        this.filteredAllUsers = active.filter(u => u.userId !== this.currentUser?.userId);

        this.usersByDepartment.clear();
        this.filteredUsersByDept.clear();

        for (const dept of this.departments) {
          const usersInDept = active
            .filter((u) => u.departmentIds?.includes(dept.departmentId))
            .filter((u) => {
              if (!this.currentUser) return false;
              const currentRole = (this.currentUser.role ?? '').toString().toUpperCase();
              if (currentRole.includes('ADMIN')) {
                return true; // admins can see all active users in department
              }
              if (currentRole.includes('HOD')) {
                return this.canHodAssignToUser(u);
              }
              return u.userId === this.currentUser.userId || this.isUserBelow(u, this.currentUser);
            })
            .sort((a, b) => (a.role === 'HOD' ? -1 : b.role === 'HOD' ? 1 : 0));
          this.usersByDepartment.set(dept.departmentId, usersInDept);
          this.filteredUsersByDept.set(dept.departmentId, [...usersInDept]);
        }

        this.isLoadingUsers = false;

        this.applyDeferredUserAssignments();
        this.updateSelectAllStates();
        this.expandFirstAccordion();
        this.onDueDateChange();

        this.cdr.markForCheck();
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
    const role = (this.currentUser?.role ?? '').toString().toUpperCase();
    const isAdmin = role.includes('ADMIN');
    if (this.taskForm.value.assignToSelf && !isAdmin) return;

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
    const role = (this.currentUser?.role ?? '').toString().toUpperCase();
    const isAdmin = role.includes('ADMIN');

    if (this.taskForm.value.assignToSelf && !isAdmin && userId !== this.currentUser?.userId) return;

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

  canHodAssignToUser(u: userDto): boolean {
    if (!this.currentUser) return false;
    if (u.userId === this.currentUser.userId) return true;

    const targetRole = u.role;
    if (targetRole === 'SUPER_ADMIN' || targetRole === 'ADMIN' || targetRole === 'SUB_ADMIN') {
      return false;
    }
    if (targetRole === 'HOD') {
      return this.isUserBelow(u, this.currentUser);
    }

    // For TEACHER / STAFF / other roles:
    const sharesDept = u.departmentIds?.some(id => this.currentUser?.departmentIds?.includes(id));
    const subDept = this.subDepartments.find(sub => sub.id === u.subDepartmentId);
    const sharesSubDept = !!(subDept && subDept.department && this.currentUser?.departmentIds?.includes(subDept.department.departmentId));

    return !!(sharesDept || sharesSubDept || this.isUserBelow(u, this.currentUser));
  }

  isUserSelectionDisabled(user: userDto): boolean {
    if (!this.currentUser) return true;

    const role = (this.currentUser.role ?? '').toString().toUpperCase();

    if (role.includes('ADMIN')) return false;

    if (role.includes('HOD')) {
      return !this.canHodAssignToUser(user);
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

    const rawForm = this.taskForm.getRawValue();
    const { startDate, dueDate, departmentIds, assignedToIds, assignToSelf, status, subDepartmentId, isTemplateTask, templateId, targetCount, targetPercentage } = rawForm;

    const v = this.validateDates(startDate, dueDate);
    if (!v.valid) {
      this.dateErrorMessage = v.msg!;
      this.cdr.markForCheck();
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
      startDate: startDate ? `${startDate}T00:00:00` : undefined,
      dueDate: `${dueDate}T00:00:00`,
      departmentIds: departmentIds || [],
      assignedToIds: finalAssigned,
      subDepartmentId: subDepartmentId || null,
      templateId: isTemplateTask ? +templateId : null,
      targetCount: (isTemplateTask && targetCount) ? +targetCount : null,
      targetPercentage: (isTemplateTask && targetPercentageVal) ? targetPercentageVal : null,
      requiresApproval: this.currentUser?.role === 'HOD',
    };

    this.isSubmitting = true;
    this.cdr.markForCheck();

    this.taskService.updateTask(this.taskId, payload).subscribe({
      next: () => {
        this.successMessage = 'Task updated successfully!';
        this.cdr.markForCheck();
        setTimeout(() => {
          if (this.isModal) {
            this.closed.emit(true);
          } else {
            this.router.navigate(['/task', this.taskId]);
          }
        }, 1500);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to update task.';
        this.isSubmitting = false;
        this.cdr.markForCheck();
      },
    });
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
      this.router.navigate(['/task', this.taskId]);
    }
  }
}