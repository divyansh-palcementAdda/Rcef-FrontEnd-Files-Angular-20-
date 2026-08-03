import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { DashboardDto } from '../../../Model/DashboardDto';
import { Subscription } from 'rxjs';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    // Get departmentId from route parameters
    this.route.queryParams.subscribe(params => {
      this.departmentId = params['departmentId'] ? +params['departmentId'] : 0;
      console.log('Department ID from route:', this.departmentId);

      // Load data after getting departmentId
      this.loadDashboardData();
      this.setupSearchSubjects();
      this.loadTasks();
      this.loadUsers();
      this.loadApprovals();
      this.loadSubDepartments();
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
      sortBy: 'createdAt',
      sortDirection: 'desc'
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
      sortBy: 'fullName',
      sortDirection: 'asc',
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
      sortBy: 'requestedDate',
      sortDirection: 'desc',
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
      sortBy: 'name',
      sortDirection: 'asc',
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
