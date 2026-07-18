import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { TaskDto } from '../../../Model/TaskDto';
import { TaskAnalyticsItemDto } from '../../../Model/TaskAnalyticsItemDto';
import { JwtService } from '../../../Services/jwt-service';
import { Subscription, of, Subject } from 'rxjs';
import { finalize, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { userDto } from '../../../Model/userDto';
import { AuthApiService } from '../../../Services/auth-api-service';
import { ModalService } from '../../../Services/modal-service';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';
import { AuthorizationService } from '../../../Services/authorization.service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { SubjectApiService } from '../../../Services/subject-api.service';
import { TaskTemplateApiService, TaskTemplateDto } from '../../../Services/task-template-api.service';
import { TaskDashboardAnalyticsDto } from '../../../Services/task-api-Service';
import { Department } from '../../../Model/department';
import { SubjectDto } from '../../../Model/subject';
import { FilterDrawerComponent, FilterFieldConfig } from '../../Shared/filter-drawer/filter-drawer.component';
import { PageToolbarComponent } from '../../Shared/page-toolbar/page-toolbar.component';
import { AnalyticsStatCardComponent } from '../../Shared/analytics-stat-card/analytics-stat-card.component';
import { TasksImportComponent } from '../tasks-import/tasks-import';


interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Component({
  selector: 'app-view-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterDrawerComponent, PageToolbarComponent, AnalyticsStatCardComponent, TasksImportComponent],

  templateUrl: './view-tasks.html',
  styleUrls: ['./view-tasks.css']
})
export class ViewTasksComponent implements OnInit, OnDestroy {
  private modalService = inject(ModalService);
  private confirmDialog = inject(ConfirmDialogService);
  private authorizationService = inject(AuthorizationService);


  // Task Data
  tasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];
  readonly Math = Math;

  // UI States
  loading = false;
  isInitialLoad = true;
  loadingMessage = 'Loading tasks...';
  errorMessage: string | null = null;
  isForbidden = false;
  isEmpty = false;
  showBulkUploadModal = false;

  // Filters
  searchTerm = '';
  statusFilter = '';
  departmentFilter = '';
  dateFilter = '';
  selectedCard = 'total';
  categoryFilter = '';
  templateFilter = '';

  // Dynamic dropdown option lists
  departmentsList: Department[] = [];
  templatesList: TaskTemplateDto[] = [];
  subjectsList: SubjectDto[] = [];
  usersList: userDto[] = [];

  // Filter Drawer configs
  filterFields: FilterFieldConfig[] = [];
  isDrawerOpen = false;


  // Filter Bindings for dynamic synchronization
  departmentIdFilter: number | '' = '';
  templateIdFilter: number | '' = '';
  subjectIdFilter: number | '' = '';
  userIdFilter: number | '' = '';
  priorityFilter: string = '';

  // Sorting
  sortBy = 'createdAt';
  sortDirection = 'desc';

  // Pagination
  currentPage = 1;
  pageSize = 12;
  totalPages = 1;
  totalTasks = 0;

  // User Info
  currentUserId: number | null = null;
  currentUserRole: string | null = null;
  currentUserDeptIds: number[] = [];

  // Analytics response DTO
  analyticsData: TaskDashboardAnalyticsDto = {
    overview: { totalTasks: 0, templateTasks: 0, generalTasks: 0, pending: 0, upcoming: 0, inProgress: 0, completed: 0, closed: 0, delayed: 0, extended: 0, requestForClosure: 0, requestForExtension: 0 },
    departmentBreakdown: [],
    templateVsGeneral: {
      templateTasks: { total: 0, pending: 0, inProgress: 0, completed: 0, closed: 0, delayed: 0, extended: 0 },
      generalTasks: { total: 0, pending: 0, inProgress: 0, completed: 0, closed: 0, delayed: 0, extended: 0 }
    },
    templateBreakdown: [],
    statusBreakdown: [],
    priorityBreakdown: [],
    userBreakdown: [],
    subjectBreakdown: [],
    charts: []
  };

  // Stats (Backward compatibility)
  taskStats: {
    total: number;
    active: number;
    pending: number;
    completed: number;
    overdue: number;
    extensionRequests: number;
    closureRequests: number;
    upcoming: number;
    templateBreakdown?: TaskAnalyticsItemDto[];
    categoryBreakdown?: TaskAnalyticsItemDto[];
    delayed?: number;
    In_PROGRESS?: number;
  } = {
    total: 0,
    active: 0,
    pending: 0,
    completed: 0,
    overdue: 0,
    extensionRequests: 0,
    closureRequests: 0,
    upcoming: 0,
    delayed: 0,
    In_PROGRESS: 0
  };

  taskTemplateBreakdown: TaskAnalyticsItemDto[] = [];
  taskCategoryBreakdown: TaskAnalyticsItemDto[] = [];

  private subscriptions = new Subscription();
  private searchSubject = new Subject<string>();

  constructor(
    private apiService: TaskApiService,
    private userService: UserApiService,
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private authApiService: AuthApiService,
    private departmentService: DepartmentApiService,
    private subjectService: SubjectApiService,
    private templateService: TaskTemplateApiService
  ) { }

  loadDropdownOptions(): void {
    this.departmentService.getAllDepartments().subscribe({
      next: (depts) => {
        this.departmentsList = depts || [];
        this.initializeFilterFields();
      },
      error: (err) => console.error('Failed to load departments', err)
    });

    this.templateService.getAllTemplates().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          this.templatesList = res.data;
          this.initializeFilterFields();
        }
      },
      error: (err) => console.error('Failed to load templates', err)
    });

    this.subjectService.getAllSubjects().subscribe({
      next: (subs) => {
        this.subjectsList = subs || [];
        this.initializeFilterFields();
      },
      error: (err) => console.error('Failed to load subjects', err)
    });

    this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.usersList = users || [];
        this.initializeFilterFields();
      },
      error: (err) => console.error('Failed to load users', err)
    });
  }

  initializeFilterFields(): void {
    this.filterFields = [
      { key: 'searchTerm', label: 'Search Keyword', type: 'text', section: 'general', placeholder: 'Enter keywords...' },
      {
        key: 'statusFilter',
        label: 'Task Status',
        type: 'select',
        section: 'general',
        options: [
          { value: 'PENDING', label: 'Pending' },
          { value: 'IN_PROGRESS', label: 'In Progress' },
          { value: 'DELAYED', label: 'Delayed' },
          { value: 'CLOSED', label: 'Completed' },
          { value: 'SELF', label: 'Assigned to Me' },
          { value: 'SELFASSIGNED', label: 'Self Assigned' },
          { value: 'APPROVAL', label: 'Awaiting Approval' },
          { value: 'MY_DEPARTMENT', label: 'My Department' },
          { value: 'PARENT_RECURRING', label: 'Recurring Parent' },
          { value: 'RECURRED_INSTANCE', label: 'Recurring Instance' }
        ]
      },
      {
        key: 'taskTypeFilter',
        label: 'Task Type',
        type: 'select',
        section: 'general',
        options: [
          { value: 'TEMPLATE', label: 'Template' },
          { value: 'GENERAL', label: 'General' }
        ]
      },
      {
        key: 'priorityFilter',
        label: 'Priority',
        type: 'select',
        section: 'general',
        options: [
          { value: 'HIGH', label: 'High' },
          { value: 'MEDIUM', label: 'Medium' },
          { value: 'LOW', label: 'Low' }
        ]
      },
      {
        key: 'departmentIdFilter',
        label: 'Department',
        type: 'select',
        section: 'organization',
        options: this.departmentsList.map(d => ({ value: d.departmentId, label: d.name }))
      },
      {
        key: 'templateIdFilter',
        label: 'Task Template',
        type: 'select',
        section: 'organization',
        options: this.templatesList.map(t => ({ value: t.id, label: t.title }))
      },
      {
        key: 'subjectIdFilter',
        label: 'Subject',
        type: 'select',
        section: 'organization',
        options: this.subjectsList.map(s => ({ value: s.id, label: s.subjectName }))
      },
      {
        key: 'userIdFilter',
        label: 'Assigned User',
        type: 'select',
        section: 'organization',
        options: this.usersList.map(u => ({ value: u.userId, label: u.fullName }))
      }
    ];
  }

  get filterValues(): { [key: string]: any } {
    return {
      searchTerm: this.searchTerm,
      statusFilter: this.statusFilter,
      taskTypeFilter: this.taskTypeFilter,
      priorityFilter: this.priorityFilter,
      departmentIdFilter: this.departmentIdFilter,
      templateIdFilter: this.templateIdFilter,
      subjectIdFilter: this.subjectIdFilter,
      userIdFilter: this.userIdFilter
    };
  }

  onApplyDrawerFilters(newValues: { [key: string]: any }): void {
    this.searchTerm = newValues['searchTerm'] || '';
    this.statusFilter = newValues['statusFilter'] || '';
    this.taskTypeFilter = newValues['taskTypeFilter'] || '';
    this.priorityFilter = newValues['priorityFilter'] || '';
    this.departmentIdFilter = newValues['departmentIdFilter'] || '';
    this.templateIdFilter = newValues['templateIdFilter'] || '';
    this.subjectIdFilter = newValues['subjectIdFilter'] || '';
    this.userIdFilter = newValues['userIdFilter'] || '';

    if (this.departmentIdFilter) {
      const dept = this.departmentsList.find(d => d.departmentId === Number(this.departmentIdFilter));
      this.departmentFilter = dept ? dept.name : '';
    } else {
      this.departmentFilter = '';
    }

    if (this.templateIdFilter) {
      const tpl = this.templatesList.find(t => t.id === Number(this.templateIdFilter));
      this.templateFilter = tpl ? tpl.title : '';
    } else {
      this.templateFilter = '';
    }

    this.onStatusDropdownChange();
  }

  ngOnInit(): void {


    this.initializeFilterFields();
    this.loadDropdownOptions();
    // Subscribe to queryParams (not snapshot) so it re-fires on every navigation
    // to this same route — this correctly resets filters when sidebar/dashboard
    // links navigate to /view-tasks with different or no query params.
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        const status = params['status'];
        this.statusFilter = status ? status.toUpperCase() : '';


        if (this.statusFilter === 'IN_PROGRESS') {
          this.selectedCard = 'active';
        } else if (this.statusFilter === 'PENDING') {
          this.selectedCard = 'pending';
        } else if (this.statusFilter === 'CLOSED') {
          this.selectedCard = 'completed';
        } else {
          this.selectedCard = 'total';
        }

        this.categoryFilter = params['category'] || '';
        this.templateFilter = params['template'] || params['templateTitle'] || '';

        // Reset user-driven filters on every navigation
        this.searchTerm = '';
        this.departmentFilter = '';
        this.currentPage = 1;

        this.loadCurrentUserAndTasks();
      })
    );

    // Debounce search — only fires API call 400ms after user stops typing
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(400),
        distinctUntilChanged()
      ).subscribe(() => {
        this.currentPage = 1;
        this.loadTasksFromServer();
      })
    );

    this.subscriptions.add(
      this.modalService.modalClosed$.subscribe(event => {
        if (event.success) {
          this.loadTasksFromServer();
        }
      })
    );
  }

  taskTypeFilter: string = '';

  /** Load current user → then load tasks. Safe to call for refresh button. */
  loadCurrentUserAndTasks(): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const userId = this.jwtService.getUserIdFromToken(token);
    if (!userId) {
      this.errorMessage = 'Invalid session. Please login again.';
      return;
    }

    // If user info already loaded, skip profile fetch and go straight to tasks
    if (this.currentUserId === userId && this.currentUserRole !== null) {
      this.loadTasksFromServer();
      this.loadAnalyticsFromServer();
      return;
    }

    this.currentUserId = userId;
    this.loading = true;
    this.loadingMessage = 'Loading user profile...';

    this.subscriptions.add(
      this.userService.getUserById(userId).subscribe({
        next: (user: userDto) => {
          this.currentUserRole = user.role;
          this.currentUserDeptIds = user.departmentIds || [];
          this.loadTasksFromServer();
          this.loadAnalyticsFromServer();
        },
        error: (err) => {
          console.error('Failed to load user profile:', err);
          this.errorMessage = 'Failed to load user profile. Please try again.';
          this.loading = false;
        }
      })
    );
  }

  buildFilterParams(): any {
    const params: any = {
      search: this.searchTerm
    };

    if (this.departmentIdFilter) {
      params.departmentId = this.departmentIdFilter;
    } else if (this.departmentFilter) {
      params.departmentName = this.departmentFilter;
    }

    if (this.categoryFilter) {
      params.category = this.categoryFilter;
    }

    if (this.templateIdFilter) {
      const tpl = this.templatesList.find(t => t.id === this.templateIdFilter);
      if (tpl) {
        params.templateTitle = tpl.title;
      }
    } else if (this.templateFilter) {
      params.templateTitle = this.templateFilter;
    }

    if (this.subjectIdFilter) {
      params.subjectId = this.subjectIdFilter;
    }

    if (this.userIdFilter) {
      params.assignedUserId = this.userIdFilter;
    }

    if (this.priorityFilter) {
      params.priority = this.priorityFilter;
    }

    if (this.taskTypeFilter) {
      params.taskType = this.taskTypeFilter;
    }

    if (this.statusFilter) {
      if (this.statusFilter === 'SELF') {
        params.assignedUserId = this.currentUserId;
      } else if (this.statusFilter === 'SELFASSIGNED') {
        params.assignedUserId = this.currentUserId;
        params.createdById = this.currentUserId;
      } else if (this.statusFilter === 'APPROVAL') {
        params.requiresApproval = true;
        params.approved = false;
      } else if (this.statusFilter === 'MY_DEPARTMENT') {
        if (this.currentUserDeptIds.length > 0) {
          params.departmentId = this.currentUserDeptIds[0];
        }
      } else if (this.statusFilter === 'PARENT_RECURRING') {
        params.isRecurringParent = true;
      } else if (this.statusFilter === 'RECURRED_INSTANCE') {
        params.isRecurredInstance = true;
      } else {
        params.status = this.statusFilter;
      }
    }

    if (this.selectedCard === 'active') {
      params.status = 'IN_PROGRESS';
    } else if (this.selectedCard === 'pending') {
      params.status = 'PENDING';
    } else if (this.selectedCard === 'completed') {
      params.status = 'CLOSED';
    } else if (this.selectedCard === 'overdue') {
      delete params.status;
      params.overdue = true;
    } else if (this.selectedCard === 'extensionRequests') {
      delete params.status;
      params.hasExtensionRequest = true;
    } else if (this.selectedCard === 'closureRequests') {
      delete params.status;
      params.hasClosureRequest = true;
    } else if (this.selectedCard === 'upcoming') {
      delete params.status;
      params.upcoming = true;
    }

    return params;
  }

  loadTasksFromServer(): void {
    this.loading = true;
    this.loadingMessage = 'Loading tasks...';

    const filterParams = this.buildFilterParams();
    const params: any = {
      ...filterParams,
      page: this.currentPage - 1,
      size: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection
    };

    this.subscriptions.add(
      this.apiService.searchTasks(params)
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, 'Failed to load tasks from server.');
            return of({ success: false, data: null } as any);
          })
        )
        .subscribe(res => {
          if (res?.success && res.data) {
            const data = res.data;
            this.tasks = data.content || [];
            this.filteredTasks = this.tasks;
            this.totalTasks = data.totalElements || 0;
            this.totalPages = data.totalPages || 1;
            this.isEmpty = this.tasks.length === 0;
            this.errorMessage = null;
            this.isForbidden = false;
            this.isInitialLoad = false;
          } else {
            this.handleError(res, res?.message || 'Error searching tasks');
          }
        })
    );
  }

  loadAnalyticsFromServer(): void {
    const params = this.buildFilterParams();
    this.subscriptions.add(
      this.apiService.getTaskDashboardAnalytics(params).subscribe({
        next: (res) => {
          if (res && res.success && res.data) {
            this.analyticsData = res.data;
            this.taskStats = {
              total: res.data.overview.totalTasks,
              active: res.data.overview.inProgress,
              pending: res.data.overview.pending,
              completed: res.data.overview.completed,
              overdue: res.data.overview.delayed,
              extensionRequests: res.data.overview.requestForExtension,
              closureRequests: res.data.overview.requestForClosure,
              upcoming: res.data.overview.upcoming,
              delayed: res.data.overview.delayed,
              In_PROGRESS: res.data.overview.inProgress
            };
          }
        },
        error: (err) => console.error('Failed to load task analytics', err)
      })
    );
  }

  get activeChips(): Array<{ key: string, label: string }> {
    const chips: Array<{ key: string, label: string }> = [];

    if (this.searchTerm) {
      chips.push({ key: 'search', label: `Search: "${this.searchTerm}"` });
    }
    if (this.statusFilter) {
      chips.push({ key: 'status', label: `Status/Type: ${this.getFilterDisplayName(this.statusFilter)}` });
    }
    if (this.departmentIdFilter) {
      const dept = this.departmentsList.find(d => d.departmentId === Number(this.departmentIdFilter));
      chips.push({ key: 'department', label: `Dept: ${dept ? dept.name : this.departmentIdFilter}` });
    }
    if (this.templateIdFilter) {
      const tpl = this.templatesList.find(t => t.id === Number(this.templateIdFilter));
      chips.push({ key: 'template', label: `Template: ${tpl ? tpl.title : this.templateIdFilter}` });
    }
    if (this.subjectIdFilter) {
      const sub = this.subjectsList.find(s => s.id === Number(this.subjectIdFilter));
      chips.push({ key: 'subject', label: `Subject: ${sub ? sub.subjectName : this.subjectIdFilter}` });
    }
    if (this.userIdFilter) {
      const u = this.usersList.find(u => u.userId === Number(this.userIdFilter));
      chips.push({ key: 'user', label: `Assignee: ${u ? u.fullName : this.userIdFilter}` });
    }
    if (this.priorityFilter) {
      chips.push({ key: 'priority', label: `Priority: ${this.priorityFilter}` });
    }
    if (this.taskTypeFilter) {
      chips.push({ key: 'taskType', label: `Task Type: ${this.taskTypeFilter}` });
    }

    return chips;
  }

  removeChip(key: string): void {
    switch (key) {
      case 'search':
        this.searchTerm = '';
        break;
      case 'status':
        this.statusFilter = '';
        this.selectedCard = 'total';
        break;
      case 'department':
        this.departmentIdFilter = '';
        this.departmentFilter = '';
        break;
      case 'template':
        this.templateIdFilter = '';
        this.templateFilter = '';
        break;
      case 'subject':
        this.subjectIdFilter = '';
        break;
      case 'user':
        this.userIdFilter = '';
        break;
      case 'priority':
        this.priorityFilter = '';
        break;
      case 'taskType':
        this.taskTypeFilter = '';
        break;
    }
    this.applyFilters();
  }

  onStatusDropdownChange(): void {
    const status = this.statusFilter;
    if (status === 'IN_PROGRESS') {
      this.selectedCard = 'active';
    } else if (status === 'PENDING') {
      this.selectedCard = 'pending';
    } else if (status === 'CLOSED') {
      this.selectedCard = 'completed';
    } else if (status === 'DELAYED') {
      this.selectedCard = 'overdue';
    } else if (status === 'REQUEST_FOR_CLOSURE') {
      this.selectedCard = 'closureRequests';
    } else if (status === 'REQUEST_FOR_EXTENSION' || status === 'EXTENDED') {
      this.selectedCard = 'extensionRequests';
    } else if (status === 'UPCOMING') {
      this.selectedCard = 'upcoming';
    } else {
      this.selectedCard = 'total';
    }
    this.applyFilters();
  }

  onDepartmentDropdownChange(): void {
    if (this.departmentIdFilter) {
      const dept = this.departmentsList.find(d => d.departmentId === Number(this.departmentIdFilter));
      this.departmentFilter = dept ? dept.name : '';
    } else {
      this.departmentFilter = '';
    }
    this.applyFilters();
  }

  onTemplateDropdownChange(): void {
    if (this.templateIdFilter) {
      const tpl = this.templatesList.find(t => t.id === Number(this.templateIdFilter));
      this.templateFilter = tpl ? tpl.title : '';
    } else {
      this.templateFilter = '';
    }
    this.applyFilters();
  }

  selectCard(cardName: string): void {
    if (this.selectedCard === cardName && !this.taskTypeFilter) {
      this.selectedCard = 'total';
      this.statusFilter = '';
    } else {
      this.selectedCard = cardName;
      if (cardName === 'total') {
        this.statusFilter = '';
      } else if (this.isSimpleStatusFilter(this.statusFilter)) {
        this.statusFilter = '';
      }
    }
    this.applyFilters();
  }

  selectStatus(status: string): void {
    if (this.statusFilter === status) {
      this.statusFilter = '';
      this.selectedCard = 'total';
    } else {
      this.statusFilter = status;
      if (status === 'IN_PROGRESS') {
        this.selectedCard = 'active';
      } else if (status === 'PENDING') {
        this.selectedCard = 'pending';
      } else if (status === 'CLOSED') {
        this.selectedCard = 'completed';
      } else if (status === 'DELAYED') {
        this.selectedCard = 'overdue';
      } else if (status === 'REQUEST_FOR_CLOSURE') {
        this.selectedCard = 'closureRequests';
      } else if (status === 'REQUEST_FOR_EXTENSION' || status === 'EXTENDED') {
        this.selectedCard = 'extensionRequests';
      } else if (status === 'UPCOMING') {
        this.selectedCard = 'upcoming';
      } else {
        this.selectedCard = 'total';
      }
    }
    this.applyFilters();
  }

  selectDepartment(deptId: number, deptName: string): void {
    if (this.departmentIdFilter === deptId) {
      this.departmentIdFilter = '';
      this.departmentFilter = '';
    } else {
      this.departmentIdFilter = deptId;
      this.departmentFilter = deptName;
    }
    this.applyFilters();
  }

  selectTaskType(type: string): void {
    if (this.taskTypeFilter === type) {
      this.taskTypeFilter = '';
    } else {
      this.taskTypeFilter = type;
    }
    this.applyFilters();
  }

  selectTemplate(tempId: number, title: string): void {
    if (this.templateIdFilter === tempId) {
      this.templateIdFilter = '';
      this.templateFilter = '';
    } else {
      this.templateIdFilter = tempId;
      this.templateFilter = title;
    }
    this.applyFilters();
  }

  selectPriority(priority: string): void {
    if (this.priorityFilter === priority) {
      this.priorityFilter = '';
    } else {
      this.priorityFilter = priority;
    }
    this.applyFilters();
  }

  selectUser(userId: number): void {
    if (this.userIdFilter === userId) {
      this.userIdFilter = '';
    } else {
      this.userIdFilter = userId;
    }
    this.applyFilters();
  }

  selectSubject(subjectId: number): void {
    if (this.subjectIdFilter === subjectId) {
      this.subjectIdFilter = '';
    } else {
      this.subjectIdFilter = subjectId;
    }
    this.applyFilters();
  }


  private isSimpleStatusFilter(filter: string): boolean {
    if (!filter) {
      return false;
    }
    const normalized = filter.toUpperCase();
    return [
      'PENDING',
      'IN_PROGRESS',
      'CLOSED',
      'UPCOMING',
      'DELAYED',
      'REQUEST_FOR_CLOSURE',
      'REQUEST_FOR_EXTENSION',
      'EXTENDED'
    ].includes(normalized);
  }

  setSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'desc';
    }
    this.currentPage = 1;
    this.loadTasksFromServer();
  }

  selectTemplateBreakdown(item: TaskAnalyticsItemDto): void {
    this.templateFilter = item.label;
    this.applyFilters();
  }

  selectCategoryBreakdown(item: TaskAnalyticsItemDto): void {
    this.categoryFilter = item.label;
    this.applyFilters();
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadTasksFromServer();
  }


  /** Called on every search keystroke — debounced, won't flash the skeleton */
  onSearchInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term;
    this.onSearchInput();
  }

  onToolbarSearchClear(): void {
    this.searchTerm = '';
    this.onSearchInput();
  }

  exportTasks(): void {
    console.log('Exporting tasks...');
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.departmentFilter = '';
    this.categoryFilter = '';
    this.templateFilter = '';
    this.selectedCard = 'total';
    this.departmentIdFilter = '';
    this.templateIdFilter = '';
    this.subjectIdFilter = '';
    this.userIdFilter = '';
    this.priorityFilter = '';
    this.taskTypeFilter = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  removeCategoryFilter(): void {
    this.categoryFilter = '';
    this.applyFilters();
  }

  removeTemplateFilter(): void {
    this.templateFilter = '';
    this.templateIdFilter = '';
    this.applyFilters();
  }

  removeStatusFilter(): void {
    this.statusFilter = '';
    this.selectedCard = 'total';
    this.applyFilters();
  }


  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadTasksFromServer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPageNumbers(): number[] {
    const maxVisiblePages = 5;
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(this.currentPage - half, 1);
    let end = Math.min(start + maxVisiblePages - 1, this.totalPages);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(end - maxVisiblePages + 1, 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get paginatedTasks(): TaskDto[] {
    return this.tasks;
  }

  goBackToDashboard() {
    const token = this.jwtService.getAccessToken();
    if (token) {
      const payload = this.jwtService.decodeToken(token);
      this.authApiService.goToDashboard();
    } else {
      this.router.navigate(['/login']);
    }
  }

  viewTaskDetails(taskId?: number): void {
    if (taskId) {
      this.router.navigate(['/task', taskId]);
    }
  }

  editTask(taskId?: number): void {
    if (taskId) {
      this.router.navigate(['/edit-task'], { queryParams: { taskId: taskId } });
    }
  }

  deleteTask(event: Event, taskId?: number): void {
    event.stopPropagation();
    if (!taskId) return;

    this.confirmDialog.confirm({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {
      if (!confirmed) return;

      this.loading = true;
      this.loadingMessage = 'Deleting task...';
      this.subscriptions.add(
        this.apiService.deleteTask(taskId)
          .pipe(
            finalize(() => this.loading = false),
            catchError(err => {
              this.handleError(err, 'Failed to delete task.');
              return of({ success: false } as ApiResponse<null>);
            })
          )
          .subscribe(res => {
            if (res?.success) {
              this.applyFilters();
            } else {
              this.handleError(res, res?.message || 'Delete failed');
            }
          })
      );
    });
  }

  getStatusClass(status?: string): string {
    switch (status?.toUpperCase()) {
      case 'PENDING':
      case 'UPCOMING': return 'status-pending';
      case 'DELAYED': return 'status-delayed blink';
      case 'REQUEST_FOR_CLOSURE':
      case 'REQUEST_FOR_EXTENSION': return 'status-request';
      case 'CLOSED': return 'status-closed';
      case 'EXTENDED': return 'status-extended';
      default: return 'status-default';
    }
  }
  /** TrackBy function for better Angular performance */
  trackByTaskId(index: number, task: TaskDto): number {
    return task.taskId || index;
  }

  /** Get display name for filter */
  getFilterDisplayName(filter: string): string {
    const filterMap: { [key: string]: string } = {
      'SELF': 'My Tasks',
      'SELFASSIGNED': 'Self Assigned',
      'APPROVAL': 'Awaiting Approval',
      'REQUEST_FOR_CLOSURE': 'Request Closure',
      'REQUEST_FOR_EXTENSION': 'Request Extension'
    };
    return filterMap[filter] || filter.split('_').map(word =>
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ');
  }

  /** Get display name for status */
  getStatusDisplayName(status?: string): string {
    if (!status) return 'Unknown';

    const statusMap: { [key: string]: string } = {
      'PENDING': 'Pending',
      'UPCOMING': 'Upcoming',
      'DELAYED': 'Delayed',
      'REQUEST_FOR_CLOSURE': 'Closure Req',
      'REQUEST_FOR_EXTENSION': 'Extension Req',
      'CLOSED': 'Completed',
      'EXTENDED': 'Extended'
    };

    return statusMap[status.toUpperCase()] ||
      status.split('_').map(word =>
        word.charAt(0) + word.slice(1).toLowerCase()
      ).join(' ');
  }

  /** Enhanced date formatting with relative time */
  formatDate(date: any): string {
    if (!date) return 'N/A';

    const d = new Date(date);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const formatted = d.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    // Add relative time indicator for due dates
    if (diffDays >= -1 && diffDays <= 7) {
      if (diffDays === 0) return `${formatted} (Today)`;
      if (diffDays === 1) return `${formatted} (Tomorrow)`;
      if (diffDays === -1) return `${formatted} (Yesterday)`;
      if (diffDays > 0) return `${formatted} (in ${diffDays} days)`;
      if (diffDays < 0) return `${formatted} (${Math.abs(diffDays)} days ago)`;
    }

    return formatted;
  }

  /** Add a method to show task importance visually */
  getPriorityClass(priority?: string): string {
    switch (priority?.toUpperCase()) {
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      case 'LOW': return 'priority-low';
      default: return 'priority-default';
    }
  }


  getStatusIcon(status?: string): string {
    switch (status?.toUpperCase()) {
      case 'PENDING': return '⏳';
      case 'UPCOMING': return '📅';
      case 'DELAYED': return '⚠️';
      case 'REQUEST_FOR_CLOSURE': return '📝';
      case 'REQUEST_FOR_EXTENSION': return '⏱️';
      case 'CLOSED': return '✅';
      case 'EXTENDED': return '🔁';
      default: return '📋';
    }
  }

  canDeleteTask(task: TaskDto): boolean {
    return this.authorizationService.canDeleteTask(task);
  }

  canEditTask(task: TaskDto): boolean {
    return this.authorizationService.canEditTask(task);
  }


  getInitials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  getAvatarColor(name?: string): string {
    if (!name) return '#64748b';
    const colors = [
      '#4f46e5', // indigo
      '#06b6d4', // cyan
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ec4899', // pink
      '#8b5cf6', // violet
      '#f43f5e', // rose
      '#3b82f6'  // blue
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  get overdueCount(): number {
    return this.tasks.filter(t => t.status === 'DELAYED').length;
  }

  get extensionsCount(): number {
    return this.tasks.filter(t => t.status === 'REQUEST_FOR_EXTENSION' || t.status === 'EXTENDED').length;
  }

  get closuresCount(): number {
    return this.tasks.filter(t => t.status === 'REQUEST_FOR_CLOSURE').length;
  }

  get upcomingCount(): number {
    return this.tasks.filter(t => t.status === 'UPCOMING').length;
  }



  private handleError(err: any, fallbackMessage: string): void {
    console.error(fallbackMessage, err);
    if (err?.status === 403) {
      this.isForbidden = true;
      this.errorMessage = null;
    } else {
      this.errorMessage = err?.error?.message || err?.message || fallbackMessage;
      this.isForbidden = false;
    }
  }

  isOverdue(task: TaskDto): boolean {
    if (!task || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    const now = new Date();
    return due < now && task.status !== 'CLOSED';
  }

  goToBulkImport(): void {
    this.showBulkUploadModal = true;
  }

  closeBulkUploadModal(): void {
    this.showBulkUploadModal = false;
    this.applyFilters();
  }

  openAddTaskModal(): void {
    this.router.navigate(['/add-task']);
  }

  hasPermission(permission: string): boolean {
    return this.authApiService.hasPermission(permission);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}