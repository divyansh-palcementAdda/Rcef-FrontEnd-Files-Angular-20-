import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
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
import { AuthApiService } from '../../Services/auth-api-service';
import { DepartmentApiService } from '../../Services/department-api-service';
import { DragScrollDirective } from '../Shared/directives/drag-scroll.directive';

@Component({
  selector: 'app-user-task-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DragScrollDirective],
  templateUrl: './user-task-analytics.component.html',
  styleUrls: ['./user-task-analytics.component.css']
})
export class UserTaskAnalyticsComponent implements OnInit, OnDestroy {

  // ── Role detection ──────────────────────────────────────────────────────
  /** True when the logged-in user is HOD or TEACHER — switches card section to Sub-Department mode */
  get isSubDeptMode(): boolean {
    const role = this.authService.getCurrentRole();
    return role === 'HOD' || role === 'TEACHER';
  }

  // ── Department/Sub-Department cards ────────────────────────────────────
  departmentCards: UserTaskDepartmentCardDTO[] = [];
  loadingCards: boolean = false;

  /** Active department filter (DEPARTMENT mode) */
  selectedDepartmentId: number | null = null;
  /** Active sub-department filter (SUB_DEPARTMENT mode — tracks the card's subDepartmentId UUID string) */
  selectedSubDepartmentCardId: string = '';

  // ── Table Data & Pagination ─────────────────────────────────────────────
  tableData: UserTaskAnalyticsRowDTO[] = [];
  loadingTable: boolean = false;
  currentPage: number = 0;
  pageSize: number = 10;
  totalRecords: number = 0;
  totalPages: number = 0;
  pageSizeOptions: number[] = [5, 10, 25];

  // ── Sorting ─────────────────────────────────────────────────────────────
  sortField: string = 'fullName';
  sortDir: string = 'asc';

  // ── Filters ─────────────────────────────────────────────────────────────
  selectedSubDepartmentId: string = '';
  selectedSubDepartmentIds: string[] = [];
  subDeptDropdownOpen: boolean = false;
  subDepartmentsOptions: any[] = [];
  loadingSubDepts: boolean = false;
  selectedRole: string = '';
  selectedUserId: number | null = null;
  selectedStatus: string = 'ALL';
  selectedPriority: string = 'ALL';
  startDate: string = '';
  endDate: string = '';
  isRecurring: boolean | null = null;
  activeUsersOnly: boolean = true;
  search: string = '';

  // ── Sub-Department Multi-Select Helper Methods ─────────────────────────
  toggleSubDeptDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.subDeptDropdownOpen = !this.subDeptDropdownOpen;
  }

  getSubDeptTriggerLabel(): string {
    if (this.selectedSubDepartmentIds.length === 0) {
      return 'All Sub Departments';
    }
    if (this.selectedSubDepartmentIds.length === 1) {
      const found = this.subDepartmentsOptions.find(sd => sd.id === this.selectedSubDepartmentIds[0]);
      return found ? found.name : '1 Sub Dept Selected';
    }
    return `${this.selectedSubDepartmentIds.length} Sub Depts Selected`;
  }

  isSubDeptSelected(id: string): boolean {
    return this.selectedSubDepartmentIds.includes(id);
  }

  toggleSubDeptSelection(id: string): void {
    if (this.isSubDeptSelected(id)) {
      this.selectedSubDepartmentIds = this.selectedSubDepartmentIds.filter(sId => sId !== id);
    } else {
      this.selectedSubDepartmentIds = [...this.selectedSubDepartmentIds, id];
    }
    this.onFilterChange();
  }

  clearSubDeptSelection(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedSubDepartmentIds = [];
    this.onFilterChange();
  }

  // ── RxJS subjects ────────────────────────────────────────────────────────
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // ── Options ──────────────────────────────────────────────────────────────
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

  // ── Request History Modal ─────────────────────────────────────────────────
  showRequestsModal: boolean = false;
  requestsModalUser: UserTaskAnalyticsRowDTO | null = null;
  modalUserRequests: UserTaskRequestDetailDTO[] = [];
  loadingRequests: boolean = false;

  openRequestsModal(user: UserTaskAnalyticsRowDTO): void {
    this.requestsModalUser = user;
    this.modalUserRequests = [];
    this.loadingRequests = true;
    this.showRequestsModal = true;

    this.analyticsService.getUserRequests(user.userId).subscribe({
      next: (reqs) => {
        this.modalUserRequests = reqs || [];
        this.loadingRequests = false;
      },
      error: (err) => {
        console.error('Error loading user requests on demand:', err);
        this.modalUserRequests = [];
        this.loadingRequests = false;
      }
    });
  }

  closeRequestsModal(): void {
    this.showRequestsModal = false;
    this.requestsModalUser = null;
    this.modalUserRequests = [];
    this.loadingRequests = false;
  }

  getRequestStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PENDING': return 'uta-req-status--pending';
      case 'APPROVED': return 'uta-req-status--approved';
      case 'REJECTED': return 'uta-req-status--rejected';
      default: return '';
    }
  }

  countRequestsByStatus(status: string): number {
    if (!this.modalUserRequests) return 0;
    return this.modalUserRequests.filter(r => (r.status || '').toUpperCase() === status).length;
  }

  // ── Drill Down Modal ─────────────────────────────────────────────────────
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
    private authService: AuthApiService,
    private deptApiService: DepartmentApiService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadDepartmentCards();
    this.loadSubDepartmentsForSelectedDept();
    // Debounced search
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 0;
      this.loadAnalyticsTable();
    });
  }

  loadSubDepartmentsForSelectedDept(): void {
    if (this.isSubDeptMode) return;
    this.loadingSubDepts = true;

    const obs$ = this.selectedDepartmentId
      ? this.deptApiService.getSubDepartmentsByDepartment(this.selectedDepartmentId)
      : this.deptApiService.getAllSubDepartments();

    obs$.subscribe({
      next: (res: any) => {
        const items = Array.isArray(res) ? res : (res?.data || res?.content || []);
        this.subDepartmentsOptions = items.map((sd: any) => ({
          id: sd.id || sd.subDepartmentId,
          name: sd.name || sd.subDepartmentName || `SubDept #${sd.id}`
        }));
        this.loadingSubDepts = false;
      },
      error: (err: any) => {
        console.error('Error fetching sub-departments for filter', err);
        this.subDepartmentsOptions = [];
        this.loadingSubDepts = false;
      }
    });
  }

  loadDepartmentCards(): void {
    this.loadingCards = true;
    this.analyticsService.getDepartmentCards(this.startDate, this.endDate).subscribe({
      next: (cards) => {
        this.departmentCards = cards || [];
        this.loadingCards = false;

        // Auto-select the first card on initial load
        if (this.departmentCards.length > 0) {
          const first = this.departmentCards[0];
          this.applyCardSelection(first);
        } else {
          // No cards returned — load table unfiltered so it doesn't stay empty
          this.loadAnalyticsTable();
        }
      },
      error: (err) => {
        console.error('Error fetching department/sub-department cards:', err);
        this.loadingCards = false;
        this.loadAnalyticsTable();
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.subDeptDropdownOpen = false;
  }

  /**
   * Applies the filter state from a clicked card without mutating the table
   * filter inputs that the user controls (role, status, dates, etc.).
   */
  private applyCardSelection(card: UserTaskDepartmentCardDTO | null): void {
    if (!card) {
      // "All" card — clear card-level selection
      this.selectedDepartmentId = null;
      this.selectedSubDepartmentCardId = '';
      this.selectedSubDepartmentId = '';
      this.selectedSubDepartmentIds = [];
    } else if (card.cardType === 'DEPARTMENT') {
      this.selectedDepartmentId = card.departmentId ?? null;
      this.selectedSubDepartmentCardId = '';
      this.selectedSubDepartmentId = '';
      this.selectedSubDepartmentIds = [];
    } else {
      // SUB_DEPARTMENT mode
      this.selectedDepartmentId = null;
      this.selectedSubDepartmentCardId = card.subDepartmentId ?? '';
      this.selectedSubDepartmentId = card.subDepartmentId ?? '';
      this.selectedSubDepartmentIds = card.subDepartmentId ? [card.subDepartmentId] : [];
    }
    this.loadSubDepartmentsForSelectedDept();
    this.currentPage = 0;
    this.loadAnalyticsTable();
  }

  /** Called when user clicks a card (department card or sub-department card). */
  selectCard(card: UserTaskDepartmentCardDTO | null): void {
    this.applyCardSelection(card);
  }

  /** Legacy method kept for any residual template references. */
  selectDepartment(deptId: number | null): void {
    this.selectedDepartmentId = deptId;
    this.selectedSubDepartmentCardId = '';
    this.selectedSubDepartmentId = '';
    this.selectedSubDepartmentIds = [];
    this.currentPage = 0;
    this.loadAnalyticsTable();
  }

  loadAnalyticsTable(): void {
    this.loadingTable = true;
    const sortParam = `${this.sortField},${this.sortDir}`;

    const subDeptParam = this.isSubDeptMode
      ? this.selectedSubDepartmentCardId
      : (this.selectedSubDepartmentIds.length > 0 ? this.selectedSubDepartmentIds.join(',') : '');

    this.analyticsService.getUserTaskAnalytics(
      this.selectedDepartmentId,
      subDeptParam,
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
        const meta = response.page ?? response;
        this.totalRecords = meta.totalElements ?? 0;
        this.totalPages = meta.totalPages ?? 0;
        this.currentPage = meta.number ?? this.currentPage;
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

  onFilterChange(): void {
    this.currentPage = 0;
    this.loadAnalyticsTable();
  }

  onDateFilterChange(): void {
    this.currentPage = 0;
    this.loadAnalyticsTable();
    this.loadDepartmentCards();
  }

  clearFilters(): void {
    this.selectedDepartmentId = null;
    this.selectedSubDepartmentCardId = '';
    this.selectedSubDepartmentId = '';
    this.selectedSubDepartmentIds = [];
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
    this.loadSubDepartmentsForSelectedDept();
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

  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Drill Down Task Modal ─────────────────────────────────────────────────
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
        this.drillDownTotalRecords = response.page?.totalElements || 0;
        this.drillDownTotalPages = response.page?.totalPages || 0;
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
      case 'HOD': return 'uta-avatar--hod';
      case 'TEACHER': return 'uta-avatar--teacher';
      case 'ADMIN': return 'uta-avatar--admin';
      case 'SUB_ADMIN': return 'uta-avatar--subadmin';
      case 'SUPER_ADMIN': return 'uta-avatar--super';
      default: return 'uta-avatar--default';
    }
  }

  getRoleBadgeClass(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'HOD': return 'uta-role--hod';
      case 'TEACHER': return 'uta-role--teacher';
      case 'ADMIN': return 'uta-role--admin';
      case 'SUB_ADMIN': return 'uta-role--subadmin';
      case 'SUPER_ADMIN': return 'uta-role--super';
      default: return 'uta-role--default';
    }
  }

  getDrillStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PENDING': return 'uta-st--pending';
      case 'IN_PROGRESS': return 'uta-st--inprogress';
      case 'CLOSED': return 'uta-st--closed';
      case 'DELAYED': return 'uta-st--delayed';
      case 'UPCOMING': return 'uta-st--upcoming';
      case 'EXTENDED': return 'uta-st--extended';
      case 'REQUEST_FOR_CLOSURE': return 'uta-st--rfc';
      case 'REQUEST_FOR_EXTENSION': return 'uta-st--rfe';
      default: return 'uta-st--default';
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
