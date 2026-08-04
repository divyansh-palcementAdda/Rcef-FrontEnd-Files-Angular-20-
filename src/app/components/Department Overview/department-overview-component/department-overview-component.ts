import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { TaskTemplateApiService, TaskTemplateDto, TaskTemplateCategoryDto } from '../../../Services/task-template-api.service';
import { SubjectApiService } from '../../../Services/subject-api.service';
import { JwtService } from '../../../Services/jwt-service';
import { RequestApiService } from '../../../Services/request-api-service';
import { DashboardDto } from '../../../Model/DashboardDto';
import { userDto } from '../../../Model/userDto';
import { Subscription } from 'rxjs';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-department-overview-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './department-overview-component.html',
  styleUrl: './department-overview-component.css',
})
 

export class DepartmentOverviewComponent implements OnInit {
  private dataSub?: Subscription;
  private tasksSub?: Subscription;
  private usersSub?: Subscription;
  private approvalsSub?: Subscription;
  private subDepartmentsSub?: Subscription;
  private searchSubject = new Subject<string>();
  private userSearchSubject = new Subject<string>();
  private approvalSearchSubject = new Subject<string>();
  private subDeptSearchSubject = new Subject<string>();
  dashboardData?: DashboardDto;
  tasksData: any;
  usersData: any;
  approvalsData: any;
  subDepartmentsData: any;
  departmentId: number = 0;
  departmentName: string = '';
  currentPage: number = 0;
  pageSize: number = 12;
  totalResults: number = 0;
  searchTerm: string = '';
  statusFilter: string = '';
  userSearchTerm: string = '';
  userRoleFilter: string = '';
  userCurrentPage: number = 0;
  userPageSize: number = 10;
  userTotalResults: number = 0;
  approvalSearchTerm: string = '';
  approvalTypeFilter: string = '';
  approvalCurrentPage: number = 0;
  approvalPageSize: number = 10;
  approvalTotalResults: number = 0;
  subDeptSearchTerm: string = '';
  subDeptStatusFilter: string = '';
  subDeptCurrentPage: number = 0;
  subDeptPageSize: number = 5;
  subDeptTotalResults: number = 0;

  // Sorting state for all tables
  sortBy: string = 'createdAt';
  sortDirection: string = 'desc';
  userSortBy: string = 'fullName';
  userSortDirection: string = 'asc';
  approvalSortBy: string = 'requestedDate';
  approvalSortDirection: string = 'desc';
  subDeptSortBy: string = 'name';
  subDeptSortDirection: string = 'asc';

  // Modal state flags
  showAddSubDepartmentModal: boolean = false;
  showAssignModal: boolean = false;
  showUpdateDepartmentModal: boolean = false;
  showAddTaskModal: boolean = false;
  showEditSubDepartmentModal: boolean = false;
  showEditUserModal: boolean = false;

  // Approve/Reject dialog state
  approveDialog: {
    isOpen: boolean;
    requestId: number | null;
    requestType: string | null;
    remarks: string;
    newDueDate: string;
  } = {
      isOpen: false,
      requestId: null,
      requestType: null,
      remarks: '',
      newDueDate: ''
    };

  rejectDialog: {
    isOpen: boolean;
    requestId: number | null;
    reason: string;
  } = {
      isOpen: false,
      requestId: null,
      reason: ''
    };

  // Form objects
  newSubDept: any = {
    departmentId: null,
    name: '',
    code: '',
    description: ''
  };

  updateDepartmentForm: any = {
    name: '',
    description: ''
  };

  newTask: any = {
    isTemplateTask: false,
    title: '',
    status: null,
    description: '',
    departmentIds: [],
    assignedToIds: [],
    assignToSelf: false,
    subDepartmentId: null,
    subDepartmentIds: [],
    subjectId: null,
    templateCategoryId: null,
    templateId: null,
    targetCount: null,
    targetPercentage: null,
    startDate: '',
    dueDate: ''
  };

  // Edit form objects
  editSubDept: any = {
    id: null,
    departmentId: null,
    name: '',
    code: '',
    description: ''
  };

  isEditMode: boolean = false;
  editingTaskId: number | null = null;

  editUser: any = {
    id: null,
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: '',
    departmentIds: [],
    subDepartmentId: null,
    subDepartmentIds: [],
    subjectIds: [],
    reportingManagerIds: [],
    reportingManagerId: null,
    subjectId: null
  };

  // Edit User Modal additional state
  showEditPassword: boolean = false;
  availableManagers: any[] = [];
  availableDepartments: any[] = [];
  availableSubDepartments: any[] = [];
  availableSubjects: any[] = [];

  // Template and dropdown data
  templateCategories: TaskTemplateCategoryDto[] = [];
  templates: TaskTemplateDto[] = [];
  filteredTemplates: TaskTemplateDto[] = [];
  selectedTemplate: TaskTemplateDto | null = null;
  subDepartments: any[] = [];
  filteredSubDepartments: any[] = [];
  subjects: any[] = [];
  departmentUsers: userDto[] = [];
  filteredDepartmentUsers: userDto[] = [];
  currentUser: userDto | null = null;
  
  // UI state
  isSubmitting: boolean = false;
  loading: boolean = false;
  taskUserSearchTerm: string = '';
  dueDateError: string = '';
  startDateError: string = '';
  minDate: string = '';
  
  // Dynamic template fields
  hasCountField: boolean = false;
  hasProgressField: boolean = false;
  progressOptions: string[] = [];

  assignSearch: string = '';
  selectedTeacherCandidates: any[] = [];
  availableTeachers: any[] = [];
  loadingTeachers: boolean = false;

  // Getter for selected teachers
  get selectedTeachers() {
    return this.availableTeachers.filter(t => t.selected);
  }

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private departmentApiService: DepartmentApiService,
    private taskApiService: TaskApiService,
    private userApiService: UserApiService,
    private templateApiService: TaskTemplateApiService,
    private subjectApiService: SubjectApiService,
    private jwtService: JwtService,
    private requestApiService: RequestApiService
  ) {
    this.minDate = new Date().toISOString().split('T')[0];
  }

  ngOnInit(): void {
    // Get departmentId from route parameters
    this.route.queryParams.subscribe(params => {
      this.departmentId = params['departmentId'] ? +params['departmentId'] : 0;
      console.log('Department ID from route:', this.departmentId);

      // Initialize task form with department ID
      this.newTask.departmentIds = [this.departmentId];

      // Load data after getting departmentId
      this.loadDepartmentName();
      this.loadDashboardData();
      this.setupSearchSubjects();
      this.loadTasks();
      this.loadUsers();
      this.loadApprovals();
      this.loadSubDepartments();
      this.loadTemplatesAndCategories();
      this.loadCurrentUser();
    });
  }

  loadDashboardData(): void {
    this.dataSub = this.apiService.getDashboardData().subscribe({
      next: (data) => {
        if (data) {
          this.dashboardData = data;
          console.log('Dashboard data received:', data);
        }
      },
      error: (err) => console.error('Error fetching dashboard data:', err)
    });
  }

  loadDepartmentName(): void {
    this.departmentApiService.getDepartmentById(this.departmentId).subscribe({
      next: (department) => {
        this.departmentName = department.name || '';
        console.log('Department name loaded:', this.departmentName);
      },
      error: (err) => {
        console.error('Error fetching department name:', err);
        this.departmentName = '';
      }
    });
  }

  setupSearchSubjects(): void {
    // Setup debounced search for tasks
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.currentPage = 0;
      this.loadTasks();
    });

    // Setup debounced search for users
    this.userSearchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.userCurrentPage = 0;
      this.loadUsers();
    });

    // Setup debounced search for approvals
    this.approvalSearchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.approvalCurrentPage = 0;
      this.loadApprovals();
    });

    // Setup debounced search for sub-departments
    this.subDeptSearchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.subDeptCurrentPage = 0;
      this.loadSubDepartments();
    });
  }

  loadTasks(): void {
    const params: any = {
      departmentId: this.departmentId,
      page: this.currentPage,
      size: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection
    };

    if (this.searchTerm && this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    if (this.statusFilter) {
      params.status = this.statusFilter;
    }

    console.log('API params:', params);

    this.tasksSub = this.apiService.searchTasks(params).subscribe({
      next: (response) => {
        console.log('Full API response:', response);
        this.tasksData = response.data;
        this.totalResults = response.data.totalElements || 0;
        console.log('Tasks content:', response.data.content);
        console.log('Total results:', this.totalResults);
      },
      error: (err) => console.error('Error fetching tasks data:', err)
    });
  }

  loadUsers(): void {
    const params: any = {
      page: this.userCurrentPage,
      size: this.userPageSize,
      sortBy: this.userSortBy,
      sortDirection: this.userSortDirection,
      departmentId: this.departmentId
    };

    if (this.userRoleFilter) {
      params.role = this.userRoleFilter.toUpperCase();
    }

    if (this.userSearchTerm && this.userSearchTerm.trim()) {
      params.search = this.userSearchTerm.trim();
    }

    console.log('User API params:', params);

    this.usersSub = this.apiService.searchUsers(params).subscribe({
      next: (response) => {
        console.log('Full User API response:', response);
        this.usersData = response.data;
        this.userTotalResults = response.data.totalElements || 0;
        console.log('Users content:', response.data.content);
        console.log('Total users:', this.userTotalResults);
      },
      error: (err) => console.error('Error fetching users data:', err)
    });
  }

  loadApprovals(): void {
    const params: any = {
      page: this.approvalCurrentPage,
      size: this.approvalPageSize,
      sortBy: this.approvalSortBy,
      sortDirection: this.approvalSortDirection,
      status: 'PENDING',
      departmentId: this.departmentId
    };

    if (this.approvalSearchTerm && this.approvalSearchTerm.trim()) {
      params.search = this.approvalSearchTerm.trim();
    }

    if (this.approvalTypeFilter) {
      params.requestType = this.approvalTypeFilter.toUpperCase();
    }

    console.log('Approval API params:', params);

    this.approvalsSub = this.apiService.searchTaskRequests(params).subscribe({
      next: (response) => {
        console.log('Full Approval API response:', response);
        this.approvalsData = response.data;
        this.approvalTotalResults = response.data.totalElements || 0;
        console.log('Approvals content:', response.data.content);
        console.log('Total approvals:', this.approvalTotalResults);
      },
      error: (err) => console.error('Error fetching approvals data:', err)
    });
  }

  loadSubDepartments(): void {
    const params: any = {
      page: this.subDeptCurrentPage,
      size: this.subDeptPageSize,
      sortBy: this.subDeptSortBy,
      sortDirection: this.subDeptSortDirection,
      departmentId: this.departmentId
    };

    if (this.subDeptSearchTerm && this.subDeptSearchTerm.trim()) {
      params.search = this.subDeptSearchTerm.trim();
    }

    if (this.subDeptStatusFilter) {
      params.status = this.subDeptStatusFilter;
    }

    console.log('Sub-Departments API params:', params);

    this.subDepartmentsSub = this.apiService.getSubDepartments(params).subscribe({
      next: (response) => {
        console.log('Full Sub-Departments API response:', response);
        
        let allSubDepartments: any[] = [];
        
        // Handle both paginated response and direct array response
        if (response.data && Array.isArray(response.data.content)) {
          // Paginated response structure
          this.subDepartmentsData = response.data;
          this.subDeptTotalResults = response.data.totalElements || 0;
          console.log('Sub-Departments content:', this.subDepartmentsData);
          console.log('Total sub-departments:', this.subDeptTotalResults);
          return;
        } else if (Array.isArray(response.data)) {
          // Direct array response wrapped in data property
          allSubDepartments = response.data;
        } else if (Array.isArray(response)) {
          // Direct array response without data wrapper
          allSubDepartments = response;
        } else {
          // Fallback
          this.subDepartmentsData = {
            content: [],
            totalElements: 0,
            totalPages: 0
          };
          this.subDeptTotalResults = 0;
          console.log('Sub-Departments content:', this.subDepartmentsData);
          console.log('Total sub-departments:', this.subDeptTotalResults);
          return;
        }
        
        // Apply client-side filtering
        let filteredSubDepartments = allSubDepartments;
        
        if (this.subDeptSearchTerm && this.subDeptSearchTerm.trim()) {
          const searchTerm = this.subDeptSearchTerm.trim().toLowerCase();
          filteredSubDepartments = filteredSubDepartments.filter(subDept => 
            subDept.name?.toLowerCase().includes(searchTerm) ||
            subDept.code?.toLowerCase().includes(searchTerm) ||
            subDept.description?.toLowerCase().includes(searchTerm)
          );
        }
        
        if (this.subDeptStatusFilter) {
          filteredSubDepartments = filteredSubDepartments.filter(subDept => 
            subDept.department?.departmentStatus === this.subDeptStatusFilter
          );
        }
        
        // Apply client-side pagination
        this.subDeptTotalResults = filteredSubDepartments.length;
        const totalPages = Math.ceil(filteredSubDepartments.length / this.subDeptPageSize);
        const startIndex = this.subDeptCurrentPage * this.subDeptPageSize;
        const endIndex = Math.min(startIndex + this.subDeptPageSize, filteredSubDepartments.length);
        const paginatedContent = filteredSubDepartments.slice(startIndex, endIndex);
        
        this.subDepartmentsData = {
          content: paginatedContent,
          totalElements: filteredSubDepartments.length,
          totalPages: totalPages
        };
        
        console.log('Sub-Departments content:', this.subDepartmentsData);
        console.log('Total sub-departments:', this.subDeptTotalResults);
      },
      error: (err) => console.error('Error fetching sub-departments data:', err)
    });
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onUserSearch(): void {
    this.userSearchSubject.next(this.userSearchTerm);
  }

  onApprovalSearch(): void {
    this.approvalSearchSubject.next(this.approvalSearchTerm);
  }

  onSubDeptSearch(): void {
    this.subDeptSearchSubject.next(this.subDeptSearchTerm);
  }

  onSubDeptStatusFilterChange(): void {
    this.subDeptCurrentPage = 0;
    this.loadSubDepartments();
  }

  onSubDeptPageChange(page: number): void {
    this.subDeptCurrentPage = page;
    this.loadSubDepartments();
  }

  onSubDeptPageSizeChange(): void {
    this.subDeptCurrentPage = 0;
    this.loadSubDepartments();
  }

  onSubDeptNextPage(): void {
    if (this.subDepartmentsData && this.subDeptCurrentPage < this.subDepartmentsData.totalPages - 1) {
      this.subDeptCurrentPage++;
      this.loadSubDepartments();
    }
  }

  onSubDeptPreviousPage(): void {
    if (this.subDeptCurrentPage > 0) {
      this.subDeptCurrentPage--;
      this.loadSubDepartments();
    }
  }

  onSubDeptFirstPage(): void {
    this.subDeptCurrentPage = 0;
    this.loadSubDepartments();
  }

  onSubDeptLastPage(): void {
    if (this.subDepartmentsData) {
      this.subDeptCurrentPage = this.subDepartmentsData.totalPages - 1;
      this.loadSubDepartments();
    }
  }

  // Sorting handlers
  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.currentPage = 0;
    this.loadTasks();
  }

  onUserSort(column: string): void {
    if (this.userSortBy === column) {
      this.userSortDirection = this.userSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.userSortBy = column;
      this.userSortDirection = 'asc';
    }
    this.userCurrentPage = 0;
    this.loadUsers();
  }

  onApprovalSort(column: string): void {
    if (this.approvalSortBy === column) {
      this.approvalSortDirection = this.approvalSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.approvalSortBy = column;
      this.approvalSortDirection = 'asc';
    }
    this.approvalCurrentPage = 0;
    this.loadApprovals();
  }

  onSubDeptSort(column: string): void {
    if (this.subDeptSortBy === column) {
      this.subDeptSortDirection = this.subDeptSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.subDeptSortBy = column;
      this.subDeptSortDirection = 'asc';
    }
    this.subDeptCurrentPage = 0;
    this.loadSubDepartments();
  }

  getSortIcon(column: string, currentSortBy: string, currentSortDirection: string): string {
    if (currentSortBy !== column) {
      return 'bi-arrow-down-up';
    }
    return currentSortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
  }

  getSubDeptPageNumbers(): number[] {
    if (!this.subDepartmentsData) return [];
    const totalPages = this.subDepartmentsData.totalPages || 1;
    const pages: number[] = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(0, this.subDeptCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  getSubDeptPaginationEnd(): number {
    return Math.min((this.subDeptCurrentPage + 1) * this.subDeptPageSize, this.subDeptTotalResults);
  }

  onApprovalTypeFilterChange(): void {
    this.approvalCurrentPage = 0;
    this.loadApprovals();
  }

  onApprovalPageChange(page: number): void {
    this.approvalCurrentPage = page;
    this.loadApprovals();
  }

  onApprovalPageSizeChange(): void {
    this.approvalCurrentPage = 0;
    this.loadApprovals();
  }

  onApprovalNextPage(): void {
    if (this.approvalCurrentPage < this.approvalsData.totalPages - 1) {
      this.approvalCurrentPage++;
      this.loadApprovals();
    }
  }

  onApprovalPreviousPage(): void {
    if (this.approvalCurrentPage > 0) {
      this.approvalCurrentPage--;
      this.loadApprovals();
    }
  }

  onApprovalFirstPage(): void {
    this.approvalCurrentPage = 0;
    this.loadApprovals();
  }

  onApprovalLastPage(): void {
    this.approvalCurrentPage = this.approvalsData.totalPages - 1;
    this.loadApprovals();
  }

  getApprovalPageNumbers(): number[] {
    if (!this.approvalsData) return [];
    const totalPages = this.approvalsData.totalPages;
    const pages: number[] = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(0, this.approvalCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  getApprovalPaginationEnd(): number {
    return Math.min((this.approvalCurrentPage + 1) * this.approvalPageSize, this.approvalTotalResults);
  }

  onUserRoleFilterChange(): void {
    this.userCurrentPage = 0;
    this.loadUsers();
  }

  onUserPageChange(page: number): void {
    this.userCurrentPage = page;
    this.loadUsers();
  }

  onUserPageSizeChange(): void {
    this.userCurrentPage = 0;
    this.loadUsers();
  }

  onUserNextPage(): void {
    if (this.userCurrentPage < this.usersData.totalPages - 1) {
      this.userCurrentPage++;
      this.loadUsers();
    }
  }

  onUserPreviousPage(): void {
    if (this.userCurrentPage > 0) {
      this.userCurrentPage--;
      this.loadUsers();
    }
  }

  onUserFirstPage(): void {
    this.userCurrentPage = 0;
    this.loadUsers();
  }

  onUserLastPage(): void {
    this.userCurrentPage = this.usersData.totalPages - 1;
    this.loadUsers();
  }

  getUserPageNumbers(): number[] {
    if (!this.usersData) return [];
    const totalPages = this.usersData.totalPages;
    const pages: number[] = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(0, this.userCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  getUserPaginationEnd(): number {
    return Math.min((this.userCurrentPage + 1) * this.userPageSize, this.userTotalResults);
  }

  onStatusFilterChange(): void {
    this.currentPage = 0;
    this.loadTasks();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadTasks();
  }

  onPageSizeChange(): void {
    this.currentPage = 0;
    this.loadTasks();
  }

  onNextPage(): void {
    if (this.currentPage < this.tasksData.totalPages - 1) {
      this.currentPage++;
      this.loadTasks();
    }
  }

  onPreviousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadTasks();
    }
  }

  onFirstPage(): void {
    this.currentPage = 0;
    this.loadTasks();
  }

  onLastPage(): void {
    this.currentPage = this.tasksData.totalPages - 1;
    this.loadTasks();
  }

  getPageNumbers(): number[] {
    if (!this.tasksData) return [];
    const totalPages = this.tasksData.totalPages;
    const pages: number[] = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(0, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  getPaginationEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalResults);
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.tasksSub?.unsubscribe();
    this.usersSub?.unsubscribe();
    this.approvalsSub?.unsubscribe();
    this.subDepartmentsSub?.unsubscribe();
    this.searchSubject.complete();
    this.userSearchSubject.complete();
    this.approvalSearchSubject.complete();
    this.subDeptSearchSubject.complete();
  }

  statCards(d: DashboardDto) {
    const c = (color: string) => color;

    const cards = [
      /* =======================
         CORE SUMMARY
      ======================= */
      {
        title: 'Total Tasks',
        value: d.totalTask,
        color: c('dark'),
        icon: 'bi-clipboard-check',
        route: '/view-tasks',
        delta: d.totalTask ?? 0
      },



      {
        title: 'Total Sub-Departments',
        value: d.activeSubDepartments,
        color: c('dark'),
        icon: 'bi-building',
        route: '/departments',
        delta: d.activeSubDepartments ?? 0
      },

      {
        title: 'Active Users',
        value: d.activeUsers,
        color: c('info'),
        icon: 'bi-person-check-fill',
        route: '/viewAllUsers',
        queryParams: { status: 'ACTIVE' },
        delta: d.activeUsers ?? 0
      },


      /* =======================
         TASK STATUS
      ======================= */
      {
        title: 'Active Tasks',
        value: d.activeTask,
        color: c('primary'),
        icon: 'bi-play-circle-fill',
        route: '/view-tasks',
        queryParams: { status: 'IN_PROGRESS' },
        delta: d.activeTask ?? 0
      },

      {
        title: 'Pending Tasks',
        value: d.pendingTask,
        color: c('warning'),
        icon: 'bi-hourglass-split',
        route: '/view-tasks',
        queryParams: { status: 'PENDING' },
        delta: d.pendingTask ?? 0
      },

      {
        title: 'Upcoming Tasks',
        value: d.upcomingTask,
        color: c('info'),
        icon: 'bi-calendar-event',
        route: '/view-tasks',
        queryParams: { status: 'UPCOMING' },
        delta: d.upcomingTask ?? 0
      },

      {
        title: 'Completed Tasks',
        value: d.completedTask,
        color: c('success'),
        icon: 'bi-check-circle-fill',
        route: '/view-tasks',
        queryParams: { status: 'CLOSED' },
        delta: d.completedTask ?? 0
      },


      /* =======================
         RISK / EXCEPTIONS
      ======================= */
      {
        title: 'Delayed Tasks',
        value: d.delayedTask,
        color: c('danger'),
        icon: 'bi-exclamation-triangle-fill',
        route: '/view-tasks',
        queryParams: { status: 'DELAYED' },
        delta: d.delayedTask ?? 0
      },



      /* =======================
         REQUESTS
      ======================= */
      {
        title: 'Extension Requests',
        value: d.requestForExtension,
        color: c('secondary'),
        icon: 'bi-clock-history',
        route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_EXTENSION' },
        delta: d.requestForExtension ?? 0
      },

      {
        title: 'Closure Requests',
        value: d.requestForClosure,
        color: c('secondary'),
        icon: 'bi-lock-fill',
        route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_CLOSURE' },
        delta: d.requestForClosure ?? 0
      },





      /* =======================
         DEPARTMENTAL INSIGHTS
      ======================= */
      {
        title: 'Departments with Zero Due Tasks',
        value: d.zeroDueDepartments,
        color: c('success'),
        icon: 'bi-shield-check',
        route: '/departments',
        queryParams: { filter: 'ZERO_DUE' },
        delta: d.zeroDueDepartments ?? 0
      },

      {
        title: 'My Department Tasks',
        value: d.myDepartmentTasks,
        color: c('primary'),
        icon: 'bi-diagram-3-fill',
        route: '/view-tasks',
        queryParams: { status: 'MY_DEPARTMENT' },
        delta: d.myDepartmentTasks ?? 0
      }

    ];

    return cards;
  }

  goToTaskPage(card: any): void {
    this.router.navigate([card.route], { queryParams: card.queryParams || {} });
  }

  goBack(): void {
    this.router.navigate(['/departments']);
  }

  viewSubDepartment(subDept: any): void {
    if (subDept && subDept.id) {
      this.router.navigate(['/sub-department-details', subDept.id]);
    }
  }

  viewTask(task: any): void {
    console.log('View task clicked:', task);
    const taskId = task.id || task.taskId || task.taskId;
    if (taskId) {
      console.log('Navigating to task:', taskId);
      this.router.navigate(['/task', taskId]);
    } else {
      console.error('No task ID found in task object:', task);
      alert('Task ID not found. Please check the data.');
    }
  }

  viewUser(user: any): void {
    console.log('View user clicked:', user);
    const userId = user.id || user.userId || user.userId;
    if (userId) {
      console.log('Navigating to user:', userId);
      this.router.navigate(['/user', userId]);
    } else {
      console.error('No user ID found in user object:', user);
      alert('User ID not found. Please check the data.');
    }
  }

  // Modal open/close functions
  openAddSubDepartmentModal(): void {
    this.showAddSubDepartmentModal = true;
    this.newSubDept = {
      departmentId: this.departmentId,
      name: '',
      code: '',
      description: ''
    };
  }

  closeAddSubDepartmentModal(): void {
    this.showAddSubDepartmentModal = false;
  }

  submitAddSubDepartment(): void {
    if (!this.newSubDept.name || !this.newSubDept.code || !this.newSubDept.departmentId) {
      alert('All fields are required to create a sub-department');
      return;
    }

    this.departmentApiService.createSubDepartment(this.newSubDept).subscribe({
      next: () => {
        alert('Sub-department created successfully');
        this.loadSubDepartments(); // Refresh the sub-departments list
        this.closeAddSubDepartmentModal();
      },
      error: (err) => {
        console.error('Failed to create sub-department:', err);
        alert('Failed to create sub-department: ' + (err?.error?.message || err?.message || 'Unknown error'));
      }
    });
  }

  // Edit Sub-Department functions
  openEditSubDepartmentModal(subDept: any): void {
    this.showEditSubDepartmentModal = true;
    // Use the correct ID field from the sub-department object
    const subDeptId = subDept.id || subDept.subDepartmentId;
    this.editSubDept = {
      id: subDeptId,
      departmentId: this.departmentId,
      name: subDept.name || '',
      code: subDept.code || '',
      description: subDept.description || ''
    };
  }

  closeEditSubDepartmentModal(): void {
    this.showEditSubDepartmentModal = false;
    this.editSubDept = {
      id: null,
      departmentId: null,
      name: '',
      code: '',
      description: ''
    };
  }

  submitEditSubDepartment(): void {
    if (!this.editSubDept.name || !this.editSubDept.code || !this.editSubDept.id) {
      alert('All fields are required to update a sub-department');
      return;
    }

    // Convert id to string for API call
    const subDeptId = String(this.editSubDept.id);
    this.departmentApiService.updateSubDepartment(subDeptId, this.editSubDept).subscribe({
      next: () => {
        alert('Sub-department updated successfully');
        this.loadSubDepartments();
        this.closeEditSubDepartmentModal();
      },
      error: (err) => {
        console.error('Failed to update sub-department:', err);
        alert('Failed to update sub-department: ' + (err?.error?.message || err?.message || 'Unknown error'));
      }
    });
  }

  // Edit User functions
  openEditUserModal(user: any): void {
    this.showEditUserModal = true;
    this.editUser = {
      id: user.userId,
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || '',
      departmentIds: user.departmentIds || [],
      subDepartmentId: user.subDepartmentId || null,
      subDepartmentIds: user.subDepartmentIds || [],
      subjectIds: user.subjectIds || [],
      reportingManagerIds: user.reportingManagerIds || [],
      reportingManagerId: user.reportingManagerIds?.[0] || null,
      subjectId: user.subjectIds?.[0] || null
    };
    
    // Load dropdown data for edit user modal
    this.loadAvailableManagers();
    this.loadAvailableDepartments();
    this.loadAvailableSubDepartments();
    this.loadAvailableSubjects();
  }

  closeEditUserModal(): void {
    this.showEditUserModal = false;
    this.showEditPassword = false;
    this.editUser = {
      id: null,
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: '',
      departmentIds: [],
      subDepartmentId: null,
      subDepartmentIds: [],
      subjectIds: [],
      reportingManagerIds: [],
      reportingManagerId: null,
      subjectId: null
    };
  }

  submitEditUser(): void {
    if (!this.editUser.fullName || !this.editUser.username || !this.editUser.email || !this.editUser.role || !this.editUser.id) {
      alert('All required fields must be filled to update a user');
      return;
    }

    // Create a simplified payload matching the user update API
    const userPayload: any = {
      fullName: this.editUser.fullName,
      username: this.editUser.username,
      email: this.editUser.email,
      role: this.editUser.role,
      departmentIds: this.editUser.departmentIds,
      subDepartmentId: this.editUser.subDepartmentId,
      subDepartmentIds: this.editUser.subDepartmentIds,
      subjectIds: this.editUser.subjectIds,
      reportingManagerIds: this.editUser.reportingManagerIds
    };

    // Only include password if it's provided
    if (this.editUser.password) {
      userPayload.password = this.editUser.password;
    }

    this.userApiService.updateUser(this.editUser.id, userPayload).subscribe({
      next: () => {
        alert('User updated successfully');
        this.loadUsers();
        this.closeEditUserModal();
      },
      error: (err) => {
        console.error('Failed to update user:', err);
        alert('Failed to update user: ' + (err?.error?.message || err?.message || 'Unknown error'));
      }
    });
  }

  // Load available managers for dropdown
  loadAvailableManagers(): void {
    this.userApiService.getAllUsers().subscribe({
      next: (users: any) => {
        this.availableManagers = users.content || users || [];
      },
      error: (err) => {
        console.error('Error loading managers:', err);
        this.availableManagers = [];
      }
    });
  }

  // Load available departments for dropdown
  loadAvailableDepartments(): void {
    this.departmentApiService.getAllDepartments().subscribe({
      next: (departments: any) => {
        this.availableDepartments = departments.content || departments || [];
      },
      error: (err) => {
        console.error('Error loading departments:', err);
        this.availableDepartments = [];
      }
    });
  }

  // Load available sub-departments for dropdown
  loadAvailableSubDepartments(): void {
    this.departmentApiService.getAllSubDepartments().subscribe({
      next: (subDepts: any) => {
        this.availableSubDepartments = subDepts.content || subDepts || [];
      },
      error: (err) => {
        console.error('Error loading sub-departments:', err);
        this.availableSubDepartments = [];
      }
    });
  }

  // Load available subjects for dropdown
  loadAvailableSubjects(): void {
    this.subjectApiService.getAllSubjects().subscribe({
      next: (subjects: any) => {
        this.availableSubjects = subjects.content || subjects || [];
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.availableSubjects = [];
      }
    });
  }

  // Check if department is selected
  isDepartmentSelected(departmentId: number): boolean {
    return this.editUser.departmentIds?.includes(departmentId) || false;
  }

  // Update department selection
  updateDepartmentSelection(event: any, departmentId: number): void {
    if (event.target.checked) {
      if (!this.editUser.departmentIds) {
        this.editUser.departmentIds = [];
      }
      this.editUser.departmentIds.push(departmentId);
    } else {
      this.editUser.departmentIds = this.editUser.departmentIds.filter((id: number) => id !== departmentId);
    }
  }

  openAssignModal(): void {
    this.showAssignModal = true;
    this.assignSearch = '';
    this.selectedTeacherCandidates = [];
    this.availableTeachers = [];
    this.loadAvailableTeachers();
  }

  loadAvailableTeachers(): void {
    this.loadingTeachers = true;
    this.apiService.searchUsers({
      role: 'TEACHER',
      departmentId: this.departmentId,
      page: 0,
      size: 20,
      sortBy: 'fullName',
      sortDirection: 'asc'
    }).subscribe({
      next: (response) => {
        let teachers = response.data?.content || [];
        // Filter by search term if provided
        if (this.assignSearch && this.assignSearch.trim()) {
          const searchLower = this.assignSearch.toLowerCase();
          teachers = teachers.filter((teacher: any) =>
            teacher.fullName?.toLowerCase().includes(searchLower) ||
            teacher.username?.toLowerCase().includes(searchLower) ||
            teacher.email?.toLowerCase().includes(searchLower)
          );
        }
        this.availableTeachers = teachers.map((teacher: any) => ({
          ...teacher,
          selected: false
        }));
        this.loadingTeachers = false;
      },
      error: (err) => {
        console.error('Failed to load teachers:', err);
        this.availableTeachers = [];
        this.loadingTeachers = false;
      }
    });
  }

  onAssignSearch(): void {
    // Debounce search could be added here
    this.loadAvailableTeachers();
  }

  closeAssignModal(): void {
    this.showAssignModal = false;
    this.availableTeachers = [];
    this.selectedTeacherCandidates = [];
  }

  submitAssign(): void {
    // Get selected teachers from available teachers
    this.selectedTeacherCandidates = this.selectedTeachers;

    if (this.selectedTeacherCandidates.length === 0) {
      alert('Please select at least one Teacher candidate');
      return;
    }

    // Since there's no direct department assignment API, we'll use user update to assign department
    const assignObservables = this.selectedTeacherCandidates.map(candidate =>
      this.userApiService.updateUser(candidate.userId, { departmentId: this.departmentId })
    );

    forkJoin(assignObservables).subscribe({
      next: () => {
        alert(`Assigned ${this.selectedTeacherCandidates.length} Teacher(s) to Department successfully`);
        this.loadUsers(); // Refresh the users list
        this.closeAssignModal();
      },
      error: (err) => {
        console.error('Failed to assign teachers:', err);
        alert('Failed to assign teachers: ' + (err?.error?.message || err?.message || 'Unknown error'));
      }
    });
  }

  openUpdateDepartmentModal(): void {
    this.showUpdateDepartmentModal = true;
    // Load current department data
    this.departmentApiService.getDepartmentById(this.departmentId).subscribe({
      next: (department) => {
        this.updateDepartmentForm = {
          name: department.name || '',
          description: department.description || ''
        };
      },
      error: (err) => {
        console.error('Failed to load department data:', err);
        alert('Failed to load department data');
        this.closeUpdateDepartmentModal();
      }
    });
  }

  closeUpdateDepartmentModal(): void {
    this.showUpdateDepartmentModal = false;
  }

  submitUpdateDepartment(): void {
    if (!this.updateDepartmentForm.name) {
      alert('Department name is required');
      return;
    }

    const payload = {
      departmentId: this.departmentId,
      name: this.updateDepartmentForm.name,
      description: this.updateDepartmentForm.description
    };

    this.departmentApiService.updateDepartment(this.departmentId, payload).subscribe({
      next: () => {
        alert('Department updated successfully');
        this.closeUpdateDepartmentModal();
        // Optionally refresh department data if needed
      },
      error: (err) => {
        console.error('Failed to update department:', err);
        alert('Failed to update department: ' + (err?.error?.message || err?.message || 'Unknown error'));
      }
    });
  }

  loadCurrentUser(): void {
    const token = this.jwtService.getAccessToken();
    if (token) {
      const userId = this.jwtService.getUserIdFromToken(token);
      if (userId) {
        this.userApiService.getUserById(userId).subscribe({
          next: (user) => {
            this.currentUser = user;
          },
          error: (err) => console.error('Failed to load current user:', err)
        });
      }
    }
  }

  loadTemplatesAndCategories(): void {
    // Load template categories
    this.templateApiService.getAllCategories().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.templateCategories = res.data.filter(c => c.isActive !== false);
        }
      },
      error: (err) => console.error('Failed to load template categories:', err)
    });

    // Load templates
    this.templateApiService.getAllTemplates().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.templates = res.data.filter(t => t.isActive !== false);
        }
      },
      error: (err) => console.error('Failed to load templates:', err)
    });

    // Load subjects
    this.subjectApiService.getAllSubjects().subscribe({
      next: (subs) => {
        this.subjects = subs || [];
      },
      error: (err) => console.error('Failed to load subjects:', err)
    });
  }

  openAddTaskModal(task?: any): void {
    this.showAddTaskModal = true;
    
    if (task) {
      // Edit mode
      this.isEditMode = true;
      this.editingTaskId = Number(task.id);
      this.newTask = {
        isTemplateTask: task.isTemplateTask || false,
        title: task.title || '',
        status: task.status || null,
        description: task.description || '',
        departmentIds: task.departmentIds || [this.departmentId],
        assignedToIds: task.assignedToIds || [],
        assignToSelf: false,
        subDepartmentId: task.subDepartmentId || null,
        subDepartmentIds: task.subDepartmentIds || [],
        subjectId: task.subjectId || null,
        templateCategoryId: task.templateCategoryId || null,
        templateId: task.templateId || null,
        targetCount: task.targetCount || null,
        targetPercentage: task.targetPercentage || null,
        startDate: task.startDate || '',
        dueDate: task.dueDate || ''
      };
      
      // Handle template selection if editing a template task
      if (task.isTemplateTask && task.templateId) {
        // We'll try to find the template, but handle case where filteredTemplates might not be loaded yet
        if (this.filteredTemplates && this.filteredTemplates.length > 0) {
          this.selectedTemplate = this.filteredTemplates.find(t => t.id === Number(task.templateId)) || null;
          this.updateTemplateValidation();
        } else {
          this.selectedTemplate = null;
          this.hasCountField = false;
          this.hasProgressField = false;
          this.progressOptions = [];
        }
      } else {
        this.selectedTemplate = null;
        this.hasCountField = false;
        this.hasProgressField = false;
        this.progressOptions = [];
      }
    } else {
      // Add mode
      this.isEditMode = false;
      this.editingTaskId = null;
      this.newTask = {
        isTemplateTask: false,
        title: '',
        status: null,
        description: '',
        departmentIds: [this.departmentId],
        assignedToIds: [],
        assignToSelf: false,
        subDepartmentId: null,
        subDepartmentIds: [],
        subjectId: null,
        templateCategoryId: null,
        templateId: null,
        targetCount: null,
        targetPercentage: null,
        startDate: '',
        dueDate: ''
      };
      this.selectedTemplate = null;
      this.hasCountField = false;
      this.hasProgressField = false;
      this.progressOptions = [];
    }
    
    this.dueDateError = '';
    this.startDateError = '';
    this.taskUserSearchTerm = '';
    this.filteredDepartmentUsers = [...this.departmentUsers];
    
    // Load department users for assignment
    this.loadDepartmentUsers();
    
    // Load sub-departments for the dropdown
    this.loadSubDepartmentsForDropdown();
  }

  loadSubDepartmentsForDropdown(): void {
    this.departmentApiService.getAllSubDepartments().subscribe({
      next: (subs) => {
        this.subDepartments = subs || [];
        // Filter sub-departments for current department
        this.filteredSubDepartments = this.subDepartments.filter(sub => 
          sub.department?.departmentId === this.departmentId
        );
        console.log('Filtered sub-departments for dropdown:', this.filteredSubDepartments);
      },
      error: (err) => {
        console.error('Failed to load sub-departments for dropdown:', err);
        this.filteredSubDepartments = [];
      }
    });
  }

  loadDepartmentUsers(): void {
    this.apiService.searchUsers({
      departmentId: this.departmentId,
      page: 0,
      size: 100,
      sortBy: 'fullName',
      sortDirection: 'asc'
    }).subscribe({
      next: (response) => {
        this.departmentUsers = response.data?.content || [];
        this.filteredDepartmentUsers = [...this.departmentUsers];
      },
      error: (err) => console.error('Failed to load department users:', err)
    });
  }

  closeAddTaskModal(): void {
    this.showAddTaskModal = false;
    this.isEditMode = false;
    this.editingTaskId = null;
  }

  // Task type and template handlers
  onTaskTypeChange(): void {
    if (!this.newTask.isTemplateTask) {
      // Reset template fields
      this.newTask.templateCategoryId = null;
      this.newTask.templateId = null;
      this.selectedTemplate = null;
      this.filteredTemplates = [];
      this.hasCountField = false;
      this.hasProgressField = false;
      this.progressOptions = [];
      this.newTask.targetCount = null;
      this.newTask.targetPercentage = null;
    }
  }

  onTemplateCategoryChange(): void {
    this.newTask.templateId = null;
    this.selectedTemplate = null;
    if (this.newTask.templateCategoryId) {
      this.filteredTemplates = this.templates.filter(t => t.category.id === +this.newTask.templateCategoryId);
    } else {
      this.filteredTemplates = [];
    }
  }

  onTemplateChange(): void {
    this.selectedTemplate = null;
    if (this.newTask.templateId) {
      const template = this.templates.find(t => t.id === +this.newTask.templateId);
      if (template) {
        this.selectedTemplate = template;
        if (template.title === 'Others') {
          this.newTask.title = '';
          this.newTask.description = '';
        } else {
          this.newTask.title = template.title;
          this.newTask.description = template.description;
        }
        this.updateTemplateValidation();
      }
    } else {
      this.newTask.title = '';
      this.newTask.description = '';
    }
  }

  updateTemplateValidation(): void {
    if (!this.selectedTemplate) {
      this.hasCountField = false;
      this.hasProgressField = false;
      this.progressOptions = [];
      return;
    }

    const hasNumberField = this.selectedTemplate.fields?.some(f => f.fieldType === 'NUMBER' && f.fieldName?.toLowerCase() === 'count') || false;
    const hasDropdownField = this.selectedTemplate.fields?.some(f => f.fieldType === 'DROPDOWN' && f.fieldName?.toLowerCase() === 'progress') || false;

    this.hasCountField = hasNumberField;
    this.hasProgressField = hasDropdownField;

    if (hasDropdownField) {
      const field = this.selectedTemplate.fields?.find(f => f.fieldType === 'DROPDOWN');
      this.progressOptions = field?.options ? field.options.split(',') : [];
    } else {
      this.progressOptions = [];
    }
  }

  // Status and date handlers
  onStatusChange(): void {
    if (this.newTask.status !== 'UPCOMING') {
      this.newTask.startDate = '';
      this.startDateError = '';
    }
  }

  validateDates(): boolean {
    this.dueDateError = '';
    this.startDateError = '';

    if (!this.newTask.dueDate) {
      this.dueDateError = 'Due date is required.';
      return false;
    }

    const startDate = this.newTask.startDate ? new Date(this.newTask.startDate) : new Date();
    const dueDate = new Date(this.newTask.dueDate);

    const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const dueOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    if (dueOnly < startOnly) {
      this.dueDateError = 'Due date cannot be before start date.';
      return false;
    }

    if (this.newTask.status === 'UPCOMING' && !this.newTask.startDate) {
      this.startDateError = 'Start date is required for upcoming tasks.';
      return false;
    }

    return true;
  }

  // User assignment handlers
  onTaskUserSearch(): void {
    const query = this.taskUserSearchTerm.toLowerCase().trim();
    this.filteredDepartmentUsers = this.departmentUsers.filter(user =>
      user.fullName.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query)
    );
  }

  toggleUserSelection(userId: number, checked: boolean): void {
    if (checked) {
      if (!this.newTask.assignedToIds.includes(userId)) {
        this.newTask.assignedToIds.push(userId);
      }
    } else {
      this.newTask.assignedToIds = this.newTask.assignedToIds.filter((id: number) => id !== userId);
    }
  }

  onAssignToSelfChange(): void {
    if (this.newTask.assignToSelf && this.currentUser) {
      // Add current user to assigned IDs
      if (!this.newTask.assignedToIds.includes(this.currentUser.userId)) {
        this.newTask.assignedToIds.push(this.currentUser.userId);
      }
    } else {
      // Remove current user from assigned IDs
      if (this.currentUser) {
        this.newTask.assignedToIds = this.newTask.assignedToIds.filter((id: number) => id !== this.currentUser!.userId);
      }
    }
  }

  // Sub-department and subject handlers
  onSubDepartmentChange(): void {
    if (this.newTask.subDepartmentId) {
      // Load subjects for this sub-department if needed
      this.newTask.subjectId = null;
    }
  }

  submitAddTask(): void {
    // Validate required fields
    if (!this.newTask.title) {
      alert('Task title is required');
      return;
    }

    if (!this.newTask.status) {
      alert('Status is required');
      return;
    }

    if (!this.newTask.description) {
      alert('Description is required');
      return;
    }

    // Validate dates
    if (!this.validateDates()) {
      return;
    }

    // Validate template fields if template task
    if (this.newTask.isTemplateTask) {
      if (!this.newTask.templateCategoryId) {
        alert('Template category is required for template-based tasks');
        return;
      }
      if (!this.newTask.templateId) {
        alert('Template is required for template-based tasks');
        return;
      }
      if (this.hasCountField && !this.newTask.targetCount) {
        alert('Target count is required for this template');
        return;
      }
      if (this.hasProgressField && !this.newTask.targetPercentage) {
        alert('Target progress is required for this template');
        return;
      }
    }

    this.isSubmitting = true;

    const payload: any = {
      title: this.newTask.title,
      description: this.newTask.description,
      status: this.newTask.status,
      departmentIds: [this.departmentId],
      assignedToIds: this.newTask.assignedToIds || [],
      dueDate: this.newTask.dueDate,
      isTemplateTask: this.newTask.isTemplateTask
    };

    // Add optional fields
    if (this.newTask.startDate) {
      payload.startDate = this.newTask.startDate;
    }
    if (this.newTask.subDepartmentId) {
      payload.subDepartmentId = this.newTask.subDepartmentId;
      payload.subDepartmentIds = [this.newTask.subDepartmentId];
    }
    if (this.newTask.subjectId) {
      payload.subjectId = this.newTask.subjectId;
    }
    if (this.newTask.isTemplateTask) {
      payload.templateId = this.newTask.templateId;
      if (this.newTask.targetCount) {
        payload.targetCount = this.newTask.targetCount;
      }
      if (this.newTask.targetPercentage) {
        payload.targetPercentage = this.newTask.targetPercentage;
      }
    }

    console.log('Submitting task payload:', payload);

    if (this.isEditMode && this.editingTaskId) {
      // Update existing task
      this.taskApiService.updateTask(this.editingTaskId, payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          alert('Task updated successfully');
          this.loadTasks();
          this.closeAddTaskModal();
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error('Failed to update task:', err);
          alert('Failed to update task: ' + (err?.error?.message || err?.message || 'Unknown error'));
        }
      });
    } else {
      // Create new task
      this.taskApiService.createTask(payload).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            alert('Task created successfully');
            this.loadTasks();
            this.closeAddTaskModal();
          } else {
            alert('Failed to create task: ' + response.message);
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error('Failed to create task:', err);
          alert('Failed to create task: ' + (err?.error?.message || err?.message || 'Unknown error'));
        }
      });
    }
  }

  // Approve/Reject Request Methods
  openApproveDialog(approval: any, event: Event): void {
    event.stopPropagation();
    this.approveDialog = {
      isOpen: true,
      requestId: approval.requestId || approval.id,
      requestType: approval.requestType,
      remarks: '',
      newDueDate: ''
    };
  }

  closeApproveDialog(): void {
    this.approveDialog.isOpen = false;
  }

  submitApprove(): void {
    if (!this.approveDialog.requestId) return;

    const payload: any = {
      requestId: this.approveDialog.requestId,
      remarks: this.approveDialog.remarks
    };

    if (this.approveDialog.requestType === 'EXTENSION' && this.approveDialog.newDueDate) {
      payload.newDueDate = this.approveDialog.newDueDate;
    }

    this.loading = true;
    this.requestApiService.approveRequestDirect(this.approveDialog.requestId, payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.closeApproveDialog();
        this.loadApprovals();
      },
      error: (err) => {
        this.loading = false;
        alert(err?.error?.message || 'Failed to approve request');
      }
    });
  }

  openRejectDialog(approval: any, event: Event): void {
    event.stopPropagation();
    this.rejectDialog = {
      isOpen: true,
      requestId: approval.requestId || approval.id,
      reason: ''
    };
  }

  closeRejectDialog(): void {
    this.rejectDialog.isOpen = false;
  }

  submitReject(): void {
    if (!this.rejectDialog.requestId) return;
    if (!this.rejectDialog.reason.trim()) {
      alert('Remarks/rejection reason is required.');
      return;
    }

    const payload = {
      requestId: this.rejectDialog.requestId,
      reason: this.rejectDialog.reason
    };

    this.loading = true;
    this.requestApiService.rejectRequestDirect(this.rejectDialog.requestId, payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.closeRejectDialog();
        this.loadApprovals();
      },
      error: (err) => {
        this.loading = false;
        alert(err?.error?.message || 'Failed to reject request');
      }
    });
  }

  viewApproval(approval: any): void {
    if (approval && approval.taskId) {
      this.router.navigate(['/task', approval.taskId]);
    } else if (approval && approval.id) {
      this.router.navigate(['/task-requests'], { queryParams: { requestId: approval.id } });
    }
  }

  getCardBackgroundColor(color: string): string {
    const colorMap: { [key: string]: string } = {
      'primary': '#e8f0fe',
      'success': '#e6f9f0',
      'danger': '#fee2e2',
      'warning': '#fef3c7',
      'info': '#e0f2fe',
      'secondary': '#f3f4f6',
      'dark': '#f3f4f6'
    };
    return colorMap[color] || '#f3f4f6';
  }

  getCardIconColor(color: string): string {
    const colorMap: { [key: string]: string } = {
      'primary': '#3d6fd4',
      'success': '#1db06a',
      'danger': '#dc2626',
      'warning': '#d97706',
      'info': '#0284c7',
      'secondary': '#6b7280',
      'dark': '#374151'
    };
    return colorMap[color] || '#374151';
  }
}
