import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  UserTaskAnalyticsApiService,
  UserTaskDepartmentCardDTO,
  UserTaskAnalyticsRowDTO,
  UserTaskRequestDetailDTO,
  TaskSummaryDTO
} from '../../Services/user-task-analytics-api.service';

@Component({
  selector: 'app-user-task-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './user-task-analytics.component.html',
  styleUrls: ['./user-task-analytics.component.css']
})
export class UserTaskAnalyticsComponent implements OnInit {
  // Department cards
  departmentCards: UserTaskDepartmentCardDTO[] = [];
  loadingCards: boolean = false;
  selectedDepartmentId: number | null = null;

  // Table Data & Pagination
  tableData: UserTaskAnalyticsRowDTO[] = [];
  loadingTable: boolean = false;
  currentPage: number = 0;
  pageSize: number = 10;
  totalRecords: number = 0;
  totalPages: number = 0;
  pageSizeOptions: number[] = [5, 10, 25, 50, 100];

  // Sorting
  sortField: string = 'fullName';
  sortDir: string = 'asc';

  // Filters
  selectedSubDepartmentId: string = '';
  selectedRole: string = '';
  selectedUserId: number | null = null;
  selectedStatus: string = 'ALL';
  selectedPriority: string = 'ALL';
  startDate: string = '';
  endDate: string = '';
  isRecurring: boolean | null = null;
  activeUsersOnly: boolean = true;
  search: string = '';

  // Options
  rolesList: string[] = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HOD', 'TEACHER'];
  statusList: string[] = [
    'ALL',
    'PENDING',
    'IN_PROGRESS',
    'UPCOMING',
    'DELAYED',
    'CLOSED',
    'REQUEST_FOR_CLOSURE',
    'REQUEST_FOR_EXTENSION',
    'EXTENDED'
  ];

  // Request History Modal
  showRequestsModal: boolean = false;
  requestsModalUser: UserTaskAnalyticsRowDTO | null = null;

  // Drill Down Modal
  showTaskModal: boolean = false;
  drillDownUser: UserTaskAnalyticsRowDTO | null = null;
  drillDownStatus: string = 'ALL';
  drillDownTasks: TaskSummaryDTO[] = [];
  loadingDrillDown: boolean = false;
  drillDownPage: number = 0;
  drillDownPageSize: number = 10;
  drillDownTotalRecords: number = 0;
  drillDownTotalPages: number = 0;

  constructor(
    private analyticsService: UserTaskAnalyticsApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDepartmentCards();
    this.loadAnalyticsTable();
  }

  loadDepartmentCards(): void {
    this.loadingCards = true;
    this.analyticsService.getDepartmentCards(this.startDate, this.endDate).subscribe({
      next: (cards) => {
        this.departmentCards = cards || [];
        this.loadingCards = false;
      },
      error: (err) => {
        console.error('Error fetching department cards:', err);
        this.loadingCards = false;
      }
    });
  }

  loadAnalyticsTable(): void {
    this.loadingTable = true;
    const sortParam = `${this.sortField},${this.sortDir}`;

    this.analyticsService.getUserTaskAnalytics(
      this.selectedDepartmentId,
      this.selectedSubDepartmentId,
      this.selectedRole,
      this.selectedUserId,
      this.selectedStatus,
      this.selectedPriority,
      this.startDate,
      this.endDate,
      this.isRecurring,
      this.activeUsersOnly,
      this.search,
      this.currentPage,
      this.pageSize,
      sortParam
    ).subscribe({
      next: (response) => {
        this.tableData = response.content || [];
        this.totalRecords = response.totalElements || 0;
        this.totalPages = response.totalPages || 0;
        this.loadingTable = false;
      },
      error: (err) => {
        console.error('Error loading analytics table:', err);
        this.tableData = [];
        this.totalRecords = 0;
        this.totalPages = 0;
        this.loadingTable = false;
      }
    });
  }

  selectDepartment(deptId: number | null): void {
    this.selectedDepartmentId = deptId;
    this.currentPage = 0;
    this.loadAnalyticsTable();
  }

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadAnalyticsTable();
    this.loadDepartmentCards();
  }

  clearFilters(): void {
    this.selectedDepartmentId = null;
    this.selectedSubDepartmentId = '';
    this.selectedRole = '';
    this.selectedUserId = null;
    this.selectedStatus = 'ALL';
    this.selectedPriority = 'ALL';
    this.startDate = '';
    this.endDate = '';
    this.isRecurring = null;
    this.activeUsersOnly = true;
    this.search = '';
    this.currentPage = 0;
    this.loadAnalyticsTable();
    this.loadDepartmentCards();
  }

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.loadAnalyticsTable();
  }

  onPageChange(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadAnalyticsTable();
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 0;
    this.loadAnalyticsTable();
  }

  // Request History Modal
  openRequestsModal(user: UserTaskAnalyticsRowDTO): void {
    this.requestsModalUser = user;
    this.showRequestsModal = true;
  }

  closeRequestsModal(): void {
    this.showRequestsModal = false;
    this.requestsModalUser = null;
  }

  getRequestStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':  return 'uta-req-status--pending';
      case 'APPROVED': return 'uta-req-status--approved';
      case 'REJECTED': return 'uta-req-status--rejected';
      default:         return '';
    }
  }

  countRequestsByStatus(user: UserTaskAnalyticsRowDTO | null, status: string): number {
    if (!user?.requests) return 0;
    return user.requests.filter(r => (r.status || '').toUpperCase() === status).length;
  }

  // Drill Down Task Modal
  openTaskDrillDown(user: UserTaskAnalyticsRowDTO, status: string = 'ALL'): void {
    this.drillDownUser = user;
    this.drillDownStatus = status;
    this.drillDownPage = 0;
    this.showTaskModal = true;
    this.loadDrillDownTasks();
  }

  closeTaskModal(): void {
    this.showTaskModal = false;
    this.drillDownUser = null;
    this.drillDownTasks = [];
  }

  loadDrillDownTasks(): void {
    if (!this.drillDownUser) return;

    this.loadingDrillDown = true;
    this.analyticsService.getUserTasksDrillDown(
      this.drillDownUser.userId,
      this.drillDownStatus,
      this.isRecurring,
      '',
      this.drillDownPage,
      this.drillDownPageSize
    ).subscribe({
      next: (response) => {
        this.drillDownTasks = response.content || [];
        this.drillDownTotalRecords = response.totalElements || 0;
        this.drillDownTotalPages = response.totalPages || 0;
        this.loadingDrillDown = false;
      },
      error: (err) => {
        console.error('Error loading drill down tasks:', err);
        this.drillDownTasks = [];
        this.loadingDrillDown = false;
      }
    });
  }

  onDrillDownPageChange(page: number): void {
    if (page >= 0 && page < this.drillDownTotalPages) {
      this.drillDownPage = page;
      this.loadDrillDownTasks();
    }
  }

  navigateToUserDetail(userId: number): void {
    this.router.navigate(['/user', userId]);
  }

  navigateToTaskDetail(taskId: number): void {
    this.closeTaskModal();
    this.router.navigate(['/task', taskId]);
  }

  exportData(format: 'EXCEL' | 'CSV'): void {
    const exportUrl = this.analyticsService.getExportUrl(
      this.selectedDepartmentId,
      this.selectedSubDepartmentId,
      this.selectedRole,
      this.selectedUserId,
      this.selectedStatus,
      this.selectedPriority,
      this.startDate,
      this.endDate,
      this.isRecurring,
      this.activeUsersOnly,
      this.search,
      format
    );
    window.open(exportUrl, '_blank');
  }

  getMathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  getAvatarClass(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'HOD':        return 'uta-avatar--hod';
      case 'TEACHER':    return 'uta-avatar--teacher';
      case 'ADMIN':      return 'uta-avatar--admin';
      case 'SUB_ADMIN':  return 'uta-avatar--subadmin';
      case 'SUPER_ADMIN':return 'uta-avatar--super';
      default:           return 'uta-avatar--default';
    }
  }

  getRoleBadgeClass(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'HOD':        return 'uta-role--hod';
      case 'TEACHER':    return 'uta-role--teacher';
      case 'ADMIN':      return 'uta-role--admin';
      case 'SUB_ADMIN':  return 'uta-role--subadmin';
      case 'SUPER_ADMIN':return 'uta-role--super';
      default:           return 'uta-role--default';
    }
  }

  getDrillStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':              return 'uta-st--pending';
      case 'IN_PROGRESS':          return 'uta-st--inprogress';
      case 'CLOSED':               return 'uta-st--closed';
      case 'DELAYED':              return 'uta-st--delayed';
      case 'UPCOMING':             return 'uta-st--upcoming';
      case 'EXTENDED':             return 'uta-st--extended';
      case 'REQUEST_FOR_CLOSURE':  return 'uta-st--rfc';
      case 'REQUEST_FOR_EXTENSION':return 'uta-st--rfe';
      default:                     return 'uta-st--default';
    }
  }

  getDueDateClass(dueDate: any, status: string): string {
    if (!dueDate || ['CLOSED', 'COMPLETED'].includes((status || '').toUpperCase())) return '';
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    if (due < now) return 'uta-date--overdue';
    if (due - now < 3 * 24 * 60 * 60 * 1000) return 'uta-date--soon';
    return '';
  }
}
