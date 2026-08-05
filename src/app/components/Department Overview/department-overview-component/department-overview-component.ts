import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { JwtService } from '../../../Services/jwt-service';
import { RequestApiService } from '../../../Services/request-api-service';
import { userDto } from '../../../Model/userDto';
import { Department } from '../../../Model/department';
import { Subscription } from 'rxjs';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { AddTaskComponent } from '../../Tasks/add-task/add-task';
import { UpdateTaskComponent } from '../../Tasks/update-task/update-task';

@Component({
  selector: 'app-department-overview-component',
  imports: [CommonModule, FormsModule, AddTaskComponent, UpdateTaskComponent],
  templateUrl: './department-overview-component.html',
  styleUrl: './department-overview-component.css',
})
 

export class DepartmentOverviewComponent implements OnInit {
  private tasksSub?: Subscription;
  private usersSub?: Subscription;
  private approvalsSub?: Subscription;
  private subDepartmentsSub?: Subscription;
  private searchSubject = new Subject<string>();
  private userSearchSubject = new Subject<string>();
  private approvalSearchSubject = new Subject<string>();
  private subDeptSearchSubject = new Subject<string>();
  tasksData: any;
  usersData: any;
  approvalsData: any;
  subDepartmentsData: any;
  departmentId: number = 0;
  departmentName: string = '';
  departmentData: Department = {} as Department;
  currentPage: number = 0;
  pageSize: number = 12;
  totalResults: number = 0;
  searchTerm: string = '';
  statusFilter: string = '';
  userSearchTerm: string = '';
  userRoleFilter: string = '';
  userCurrentPage: number = 0;
  userPageSize: number = 20;
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
  showEditTaskModal: boolean = false;
  showEditSubDepartmentModal: boolean = false;
  showEditUserModal: boolean = false;
  
  // Task related state
  selectedTaskId: number | null = null;

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

  // Edit form objects
  editSubDept: any = {
    id: null,
    departmentId: null,
    name: '',
    code: '',
    description: ''
  };



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

  // User and assign data
  currentUser: userDto | null = null;
  
  // UI state
  isSubmitting: boolean = false;
  loading: boolean = false;
  minDate: string = '';

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

      // Load data after getting departmentId
      this.loadDepartmentName();
      this.setupSearchSubjects();
      this.loadTasks();
      this.loadUsers();
      this.loadApprovals();
      this.loadSubDepartments();
      this.loadCurrentUser();
    });
  }

  loadDepartmentName(): void {
    this.departmentApiService.getDepartmentById(this.departmentId).subscribe({
      next: (department) => {
        this.departmentData = department;
        this.departmentName = department.name || department.departmentName || '';
        console.log('Department data loaded:', this.departmentData);
      },
      error: (err) => {
        console.error('Error fetching department name:', err);
        this.departmentName = '';
        this.departmentData = {} as Department;
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
        // Task API has direct totalElements
        this.totalResults = response.data.totalElements || 0;
        // Add pagination object for consistency
        if (this.tasksData && !this.tasksData.pagination) {
          this.tasksData.pagination = {
            totalPages: this.tasksData.totalPages || 0,
            totalElements: this.tasksData.totalElements || 0
          };
        }
        console.log('Tasks content:', response.data.content);
        console.log('Total results:', this.totalResults);
      },
      error: (err) => console.error('Error fetching tasks data:', err)
    });
  }

  loadUsers(): void {
    const params: any = {
      page: isNaN(this.userCurrentPage) ? 0 : this.userCurrentPage,
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
        // User API has pagination inside data.pagination
        this.userTotalResults = response.data.pagination?.totalElements || response.data.totalElements || 0;
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
        // Handle both pagination structures
        this.approvalTotalResults = response.data.pagination?.totalElements || response.data.totalElements || 0;
        // Add pagination object for consistency
        if (this.approvalsData && !this.approvalsData.pagination) {
          this.approvalsData.pagination = {
            totalPages: this.approvalsData.totalPages || 0,
            totalElements: this.approvalsData.totalElements || 0
          };
        }
        console.log('Approvals content:', response.data.content);
        console.log('Total approvals:', this.approvalTotalResults);
      },
      error: (err) => console.error('Error fetching approvals data:', err)
    });
  }

  loadSubDepartments(): void {
    console.log('Loading sub-departments for department ID:', this.departmentId);

    this.subDepartmentsSub = this.departmentApiService.getSubDepartmentsByDepartment(this.departmentId).subscribe({
      next: (response) => {
        console.log('Full Sub-Departments API response:', response);
        
        let allSubDepartments: any[] = [];

        // Handle both paginated response and direct array response
        if (Array.isArray(response)) {
          // Direct array response without data wrapper
          allSubDepartments = response;
        } else if (response && typeof response === 'object' && 'data' in response) {
          if (Array.isArray(response.data.content)) {
            // Paginated response structure
            this.subDepartmentsData = response.data;
            // Handle both pagination structures
            this.subDeptTotalResults = response.data.pagination?.totalElements || response.data.totalElements || 0;
            console.log('Sub-Departments content:', this.subDepartmentsData);
            console.log('Total sub-departments:', this.subDeptTotalResults);
            return;
          } else if (Array.isArray(response.data)) {
            // Direct array response wrapped in data property
            allSubDepartments = response.data;
          }
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
          totalPages: totalPages,
          pagination: {
            totalPages: totalPages,
            totalElements: filteredSubDepartments.length
          }
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
    if (this.subDepartmentsData && this.subDeptCurrentPage < this.subDepartmentsData.pagination?.totalPages - 1) {
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
      this.subDeptCurrentPage = this.subDepartmentsData.pagination?.totalPages - 1;
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
    const totalPages = this.subDepartmentsData.pagination?.totalPages || 1;
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
    if (this.approvalsData && this.approvalCurrentPage < this.approvalsData.pagination?.totalPages - 1) {
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
    if (this.approvalsData) {
      this.approvalCurrentPage = this.approvalsData.pagination?.totalPages - 1 || 0;
      this.loadApprovals();
    }
  }

  getApprovalPageNumbers(): number[] {
    if (!this.approvalsData) return [];
    const totalPages = this.approvalsData.pagination?.totalPages || 0;
    if (totalPages <= 1) return [];
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
    if (this.usersData && this.usersData.pagination?.totalPages && this.userCurrentPage < this.usersData.pagination.totalPages - 1) {
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
    if (this.usersData && this.usersData.pagination?.totalPages) {
      this.userCurrentPage = this.usersData.pagination.totalPages - 1;
      this.loadUsers();
    }
  }

  getUserPageNumbers(): number[] {
    if (!this.usersData) return [];
    const totalPages = this.usersData.pagination?.totalPages || 0;
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
    if (this.tasksData && this.currentPage < this.tasksData.pagination?.totalPages - 1) {
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
    if (this.tasksData) {
      this.currentPage = this.tasksData.pagination?.totalPages - 1 || 0;
      this.loadTasks();
    }
  }

  getPageNumbers(): number[] {
    if (!this.tasksData) return [];
    const totalPages = this.tasksData.pagination?.totalPages || 0;
    if (totalPages <= 1) return [];
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
    this.tasksSub?.unsubscribe();
    this.usersSub?.unsubscribe();
    this.approvalsSub?.unsubscribe();
    this.subDepartmentsSub?.unsubscribe();
    this.searchSubject.complete();
    this.userSearchSubject.complete();
    this.approvalSearchSubject.complete();
    this.subDeptSearchSubject.complete();
  }

  statCards() {
    const c = (color: string) => color;

    // Calculate values from component data
    const allTasks = this.tasksData?.content || [];
    const allUsers = this.usersData?.content || [];
    const allApprovals = this.approvalsData?.content || [];
    const allSubDepartments = this.subDepartmentsData?.content || [];

    // Use total results from pagination for overall counts
    const totalTasks = this.totalResults || 0;
    const totalSubDepartments = this.subDeptTotalResults || 0;
    const totalUsers = this.userTotalResults || 0;
    const totalApprovals = this.approvalTotalResults || 0;

    // Calculate task counts by status (from current page content)
    const activeTasks = allTasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
    const pendingTasks = allTasks.filter((t: any) => t.status === 'PENDING').length;
    const upcomingTasks = allTasks.filter((t: any) => t.status === 'UPCOMING').length;
    const completedTasks = allTasks.filter((t: any) => t.status === 'CLOSED').length;
    const delayedTasks = allTasks.filter((t: any) => t.status === 'DELAYED').length;

    // Calculate request counts (from current page content)
    const extensionRequests = allApprovals.filter((a: any) => a.requestType === 'EXTENSION').length;
    const closureRequests = allApprovals.filter((a: any) => a.requestType === 'CLOSURE').length;

    // Calculate other counts (from current page content)
    const activeUsers = allUsers.filter((u: any) => u.status === 'ACTIVE').length;
    
    // Calculate departments with zero due tasks (tasks that are not delayed)
    const zeroDueTasks = allTasks.filter((t: any) => t.status !== 'DELAYED').length;
    
    // My department tasks (all tasks for this department)
    const myDepartmentTasks = totalTasks;

    const cards = [
      /* =======================
         CORE SUMMARY
      ======================= */
      {
        title: 'Total Tasks',
        value: totalTasks,
        color: c('dark'),
        icon: 'bi-clipboard-check',
        route: '/view-tasks',
        delta: totalTasks
      },

      {
        title: 'Total Sub-Departments',
        value: totalSubDepartments,
        color: c('dark'),
        icon: 'bi-building',
        route: '/departments',
        delta: totalSubDepartments
      },

      {
        title: 'Active Users',
        value: activeUsers,
        color: c('info'),
        icon: 'bi-person-check-fill',
        route: '/viewAllUsers',
        queryParams: { status: 'ACTIVE' },
        delta: activeUsers
      },

      /* =======================
         TASK STATUS
      ======================= */
      {
        title: 'Active Tasks',
        value: activeTasks,
        color: c('primary'),
        icon: 'bi-play-circle-fill',
        route: '/view-tasks',
        queryParams: { status: 'IN_PROGRESS' },
        delta: activeTasks
      },

      {
        title: 'Pending Tasks',
        value: pendingTasks,
        color: c('warning'),
        icon: 'bi-hourglass-split',
        route: '/view-tasks',
        queryParams: { status: 'PENDING' },
        delta: pendingTasks
      },

      {
        title: 'Upcoming Tasks',
        value: upcomingTasks,
        color: c('info'),
        icon: 'bi-calendar-event',
        route: '/view-tasks',
        queryParams: { status: 'UPCOMING' },
        delta: upcomingTasks
      },

      {
        title: 'Completed Tasks',
        value: completedTasks,
        color: c('success'),
        icon: 'bi-check-circle-fill',
        route: '/view-tasks',
        queryParams: { status: 'CLOSED' },
        delta: completedTasks
      },

      /* =======================
         RISK / EXCEPTIONS
      ======================= */
      {
        title: 'Delayed Tasks',
        value: delayedTasks,
        color: c('danger'),
        icon: 'bi-exclamation-triangle-fill',
        route: '/view-tasks',
        queryParams: { status: 'DELAYED' },
        delta: delayedTasks
      },

      /* =======================
         REQUESTS
      ======================= */
      {
        title: 'Extension Requests',
        value: extensionRequests,
        color: c('secondary'),
        icon: 'bi-clock-history',
        route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_EXTENSION' },
        delta: extensionRequests
      },

      {
        title: 'Closure Requests',
        value: closureRequests,
        color: c('secondary'),
        icon: 'bi-lock-fill',
        route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_CLOSURE' },
        delta: closureRequests
      },

      /* =======================
         DEPARTMENTAL INSIGHTS
      ======================= */
      {
        title: 'Departments with Zero Due Tasks',
        value: zeroDueTasks,
        color: c('success'),
        icon: 'bi-shield-check',
        route: '/departments',
        queryParams: { filter: 'ZERO_DUE' },
        delta: zeroDueTasks
      },

      {
        title: 'My Department Tasks',
        value: myDepartmentTasks,
        color: c('primary'),
        icon: 'bi-diagram-3-fill',
        route: '/view-tasks',
        queryParams: { status: 'MY_DEPARTMENT' },
        delta: myDepartmentTasks
      }

    ];

    return cards;
  }

  isCardClickable(card: any): boolean {
    const nonNavigableCards = ['Total Tasks', 'Total Sub-Departments', 'Departments with Zero Due Tasks'];
    return !nonNavigableCards.includes(card.title);
  }

  onCardClick(card: any): void {
    // Check if this is a card that should not navigate
    const nonNavigableCards = ['Total Tasks', 'Total Sub-Departments', 'Departments with Zero Due Tasks'];
    if (nonNavigableCards.includes(card.title)) {
      return; // Do nothing for these cards
    }

    // Check if this is a task-related card with status filter
    if (card.queryParams && card.queryParams.status) {
      // Set the status filter and reload tasks
      this.statusFilter = card.queryParams.status;
      this.currentPage = 0; // Reset to first page
      this.loadTasks();
      
      // Scroll to the tasks table
      setTimeout(() => {
        const taskTableSection = document.querySelector('.table-section');
        if (taskTableSection) {
          taskTableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      // For non-task cards, use original navigation behavior
      this.router.navigate([card.route], { queryParams: card.queryParams || {} });
    }
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

  openAddTaskModal(task?: any): void {
    if (task) {
      // Edit mode - use update-task component
      this.selectedTaskId = Number(task.id);
      this.showEditTaskModal = true;
    } else {
      // Add mode - use add-task component
      this.showAddTaskModal = true;
    }
  }

  closeAddTaskModal(): void {
    this.showAddTaskModal = false;
  }

  closeEditTaskModal(): void {
    this.showEditTaskModal = false;
    this.selectedTaskId = null;
  }

  // Task modal handlers - using separate components now
  onTaskModalClosed(refresh: boolean = false): void {
    this.closeAddTaskModal();
    this.closeEditTaskModal();
    if (refresh) {
      this.loadTasks();
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
