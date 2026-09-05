import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService, TemplateTaskSummaryDto } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuditLogApiService } from '../../../Services/audit-log-api-service';
import { SidebarService } from '../../../Services/sidebar-service';
import { userDto } from '../../../Model/userDto';
import { TaskDto } from '../../../Model/TaskDto';
import { Department } from '../../../Model/department';
import { AuditLog } from '../../../Model/audit-log';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TaskStatus } from '../../../Model/TaskStatus';
import { JwtService } from '../../../Services/jwt-service';
import { DatePipe } from '@angular/common';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';
import { EditUser } from '../edit-user/edit-user';
import { DragScrollDirective } from '../../Shared/directives/drag-scroll.directive';

@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [CommonModule, FormsModule, EditUser, DragScrollDirective],
  templateUrl: './view-user.html',
  styleUrls: ['./view-user.css'],
})
export class ViewUserComponent implements OnInit, OnDestroy {
  Math = Math;
  userId!: number;
  user?: userDto;
  isLoading = true;

  /** Injected <style> tag to suppress sidebar z-index while modal is open */
  private _modalStyleEl: HTMLStyleElement | null = null;
  
  /** Store previous sidebar state to restore when modal closes */
  private previousMobileOpen = false;
  private previousCollapsedState = false;
  
  errorMessage = '';
  isForbidden = false;
  isMobile = false;

  currentUserRole = '';
  currentUserDepartments: number[] = [];
  isHOD = false;

  userTasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];
  searchTerm = '';
  statusFilter = '';
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;
  TaskStatus = TaskStatus;

  userLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  searchTermLogs = '';
  currentPageLogs = 1;
  pageSizeLogs = 5;
  totalPagesLogs = 1;

  activeTab: 'tasks' | 'departments' | 'logs' = 'tasks';

  taskStats = [
    { label: 'PENDING', count: 0, icon: 'bi-clock', color: '#F59E0B', gradient: 'from-amber-500 to-orange-500' },
    { label: 'UPCOMING', count: 0, icon: 'bi-calendar-event', color: '#0EA5E9', gradient: 'from-cyan-500 to-blue-500' },
    { label: 'DELAYED', count: 0, icon: 'bi-exclamation-triangle', color: '#EF4444', gradient: 'from-red-500 to-pink-500' },
    { label: 'COMPLETED', count: 0, icon: 'bi-check-circle', color: '#10B981', gradient: 'from-emerald-500 to-green-500' },
    { label: 'IN_PROGRESS', count: 0, icon: 'bi-arrow-repeat', color: '#6366F1', gradient: 'from-indigo-500 to-purple-500' }
  ];

  enrichedDepartments: any[] = [];
  recentActivity: any[] = [];
  loadingLogs = false;

  // ── Task Type Breakdown (from API) ──
  taskTypeSummary: TemplateTaskSummaryDto[] = [
    { templateTitle: 'Meeting Task', count: 0 },
    { templateTitle: 'Consultancy Task', count: 0 },
    { templateTitle: 'Visits Task', count: 0 },
    { templateTitle: 'Fees Task', count: 0 },
    { templateTitle: 'Forms Task', count: 0 },
  ];
  taskTypeFilter = '';        // holds the selected templateTitle value
  loadingTypeSummary = false;

  // Task Distribution State
  taskDistribution: any = null;
  loadingDistribution = false;
  hasDistributionAccess = true;
  selectedDistributionStatus = 'ALL';
  distributionStatsCards: any[] = [];

  // Modal State
  isTaskModalOpen = false;
  isEditModalOpen = false;
  modalTargetType: 'department' | 'subdepartment' | 'all' | null = null;
  modalTargetId: any = null;
  modalTargetName = '';

  modalTasks: TaskDto[] = [];
  modalTotalTasks = 0;
  modalSearch = '';
  modalStatus = 'ALL';
  modalPriority = '';
  modalTaskType = '';
  modalPage = 1;
  modalPageSize = 10;
  modalSortBy = 'createdAt';
  modalSortDir = 'desc';
  modalLoading = false;

  // Distribution tables state variables
  departmentSearch = '';
  departmentSortBy = 'departmentName';
  departmentSortDir = 'asc';
  deptPage = 1;
  deptPageSize = 10;
  deptTotal = 0;

  subDepartmentSearch = '';
  subDepartmentSortBy = 'subDepartmentName';
  subDepartmentSortDir = 'asc';
  subDeptPage = 1;
  subDeptPageSize = 10;
  subDeptTotal = 0;

  subjectSearch = '';
  subjectSortBy = 'subjectName';
  subjectSortDir = 'asc';
  subjectPage = 1;
  subjectPageSize = 10;
  subjectTotal = 0;

  // Debounce subjects — prevent focus-loss on rapid keystrokes
  private _deptSearch$ = new Subject<string>();
  private _subDeptSearch$ = new Subject<string>();
  private _subjectSearch$ = new Subject<string>();
  private _modalSearch$ = new Subject<string>();

  // Flag to skip overwriting search terms from queryParams after first load
  private _searchParamsInitialized = false;

  modalStatusTabs = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Delayed', value: 'DELAYED' },
    { label: 'Upcoming', value: 'UPCOMING' },
    { label: 'Extended', value: 'EXTENDED' },
    { label: 'Closure Requests', value: 'REQUEST_FOR_CLOSURE' },
    { label: 'Extension Requests', value: 'REQUEST_FOR_EXTENSION' },
    { label: 'Recurring Parent', value: 'RECURRING_PARENT' }
  ];

  /**
   * Keyword → icon/CSS mapping.
   * Matched by doing a case-insensitive substring check on templateTitle.
   */
  private readonly typeKeywords: Array<{ keyword: string; icon: string; cssClass: string }> = [
    { keyword: 'meeting', icon: 'bi-people-fill', cssClass: 'task-type-meeting' },
    { keyword: 'consultancy', icon: 'bi-chat-square-text-fill', cssClass: 'task-type-consultancy' },
    { keyword: 'visit', icon: 'bi-geo-alt-fill', cssClass: 'task-type-visits' },
    { keyword: 'fee', icon: 'bi-cash-coin', cssClass: 'task-type-fees' },
    { keyword: 'form', icon: 'bi-file-earmark-text-fill', cssClass: 'task-type-forms' },
    { keyword: 'field', icon: 'bi-map-fill', cssClass: 'task-type-visits' },
    { keyword: 'document', icon: 'bi-camera-video-fill', cssClass: 'task-type-forms' },
    { keyword: 'movie', icon: 'bi-film', cssClass: 'task-type-forms' },
    { keyword: 'syllabus', icon: 'bi-journal-bookmark-fill', cssClass: 'task-type-consultancy' },
    { keyword: 'research', icon: 'bi-search', cssClass: 'task-type-meeting' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private userService: UserApiService,
    private taskService: TaskApiService,
    private deptService: DepartmentApiService,
    private auditLogService: AuditLogApiService,
    private confirmDialog: ConfirmDialogService,
    private sidebarService: SidebarService
  ) { }

  /** Inject a global <style> to push sidebar behind the modal overlay */
  // private suppressSidebarZIndex(): void {
  //   document.body.classList.add('modal-open');
  //   if (this._modalStyleEl) return;
  //   const style = document.createElement('style');
  //   style.id = 'vu-modal-sidebar-fix';
  //   style.textContent = `
  //     /* Suppress sidebar */
  //     .sidebar-wrapper {
  //       z-index: 1 !important;
  //       pointer-events: none !important;
  //       filter: blur(2px) !important;
  //       -webkit-filter: blur(2px) !important;
  //       opacity: 0.4 !important;
  //       transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  //     }
  //     app-sidebar { 
  //       z-index: 1 !important; 
  //     }

  //     /* Suppress topbar */
  //     app-topbar,
  //     .topbar,
  //     [class*="topbar"] {
  //       z-index: 1 !important;
  //       pointer-events: none !important;
  //       filter: blur(2px) !important;
  //       -webkit-filter: blur(2px) !important;
  //       opacity: 0.4 !important;
  //       transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  //     }

  //     .app-layout { 
  //       position: relative !important; 
  //     }

  //     /* Ensure modals are on top */
  //     .view-user-modal-overlay,
  //     .edit-user-modal-overlay { 
  //       z-index: 100001 !important; 
  //     }

  //     .view-user-modal-card,
  //     .edit-user-modal-card {
  //       z-index: 100002 !important;
  //     }
  //   `;
  //   document.head.appendChild(style);
  //   this._modalStyleEl = style;
  // }

  /** Close/collapse sidebar when modal opens */
  private closeSidebarForModal(): void {
    // Store current sidebar state using public getters
    this.previousMobileOpen = this.sidebarService.getIsMobileOpen();
    this.previousCollapsedState = this.sidebarService.getIsCollapsed();
    
    console.log('Sidebar state before modal:', { 
      previousMobileOpen: this.previousMobileOpen, 
      previousCollapsedState: this.previousCollapsedState 
    });
    
    // Close sidebar on mobile
    this.sidebarService.setMobileSidebarOpen(false);
    
    // Collapse sidebar on desktop/tablet
    if (!this.previousCollapsedState) {
      this.sidebarService.toggleCollapsed();
    }
    
    console.log('Sidebar closed for modal');
  }

  /** Restore sidebar to previous state when modal closes */
  private restoreSidebar(): void {
    console.log('Restoring sidebar to state:', { 
      previousMobileOpen: this.previousMobileOpen, 
      previousCollapsedState: this.previousCollapsedState 
    });
    
    // Restore mobile sidebar state
    this.sidebarService.setMobileSidebarOpen(this.previousMobileOpen);
    
    // Restore collapsed state - only toggle if it was expanded and is now collapsed
    if (this.previousCollapsedState === false && this.sidebarService.getIsCollapsed() === true) {
      this.sidebarService.toggleCollapsed();
    }
    
    console.log('Sidebar restored');
  }

  /** Remove the injected style to restore sidebar */
  private restoreSidebarZIndex(): void {
    if (this._modalStyleEl) {
      this._modalStyleEl.remove();
      this._modalStyleEl = null;
    }
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    this.restoreSidebar();
  }

  ngOnDestroy(): void {
    this.restoreSidebarZIndex();
    document.body.style.overflow = '';
    this._deptSearch$.complete();
    this._subDeptSearch$.complete();
    this._subjectSearch$.complete();
    this._modalSearch$.complete();
    this._searchParamsInitialized = false;
  }

  ngOnInit(): void {
    this.checkScreenSize();
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.userId) {
      this.errorMessage = 'Invalid User ID';
      this.isLoading = false;
      return;
    }

    // ── Debounced search pipes — keep focus alive during API reload ──
    this._deptSearch$.pipe(debounceTime(400), distinctUntilChanged()).subscribe(val => {
      this.departmentSearch = val;
      this.deptPage = 1;
      this.updateQueryParams();
    });
    this._subDeptSearch$.pipe(debounceTime(400), distinctUntilChanged()).subscribe(val => {
      this.subDepartmentSearch = val;
      this.subDeptPage = 1;
      this.updateQueryParams();
    });
    this._subjectSearch$.pipe(debounceTime(400), distinctUntilChanged()).subscribe(val => {
      this.subjectSearch = val;
      this.subjectPage = 1;
      this.updateQueryParams();
    });
    this._modalSearch$.pipe(debounceTime(400), distinctUntilChanged()).subscribe(val => {
      this.modalSearch = val;
      this.modalPage = 1;
      this.updateQueryParams();
    });
    // ────────────────────────────────────────────────────────────────

    this.route.queryParams.subscribe(params => {
      // Restore modal states
      if (params['modalType'] && params['modalId']) {
        this.modalTargetType = params['modalType'] as any;
        this.modalTargetId = Number(params['modalId']) || params['modalId'];
        this.modalTargetName = params['modalName'] || '';
        this.modalStatus = params['modalStatus'] || 'ALL';
        // Only restore modalSearch from params on initial load — after that the
        // debounce subject owns it so we never clobber the live input value
        if (!this._searchParamsInitialized) {
          this.modalSearch = params['modalSearch'] || '';
        }
        this.modalPage = params['modalPage'] ? Number(params['modalPage']) : 1;
        this.modalSortBy = params['modalSortBy'] || 'createdAt';
        this.modalSortDir = params['modalSortDir'] || 'desc';
        this.isTaskModalOpen = true;
      } else {
        this.isTaskModalOpen = false;
      }

      // Restore distribution table states
      this.selectedDistributionStatus = params['distStatus'] || 'ALL';

      // Only restore search terms from URL on the very first load.
      // After that the debounce subjects own these values — overwriting them
      // from queryParams would re-trigger [value] binding → DOM update → focus lost.
      if (!this._searchParamsInitialized) {
        this.departmentSearch = params['deptSearch'] || '';
        this.subDepartmentSearch = params['subDeptSearch'] || '';
        this.subjectSearch = params['subjectSearch'] || '';
        this._searchParamsInitialized = true;
      }

      this.departmentSortBy = params['deptSortBy'] || 'departmentName';
      this.departmentSortDir = params['deptSortDir'] || 'asc';
      this.deptPage = params['deptPage'] ? Number(params['deptPage']) : 1;
      this.deptPageSize = params['deptPageSize'] ? Number(params['deptPageSize']) : 10;

      this.subDepartmentSortBy = params['subDeptSortBy'] || 'subDepartmentName';
      this.subDepartmentSortDir = params['subDeptSortDir'] || 'asc';
      this.subDeptPage = params['subDeptPage'] ? Number(params['subDeptPage']) : 1;
      this.subDeptPageSize = params['subDeptPageSize'] ? Number(params['subDeptPageSize']) : 10;

      this.subjectSortBy = params['subjectSortBy'] || 'subjectName';
      this.subjectSortDir = params['subjectSortDir'] || 'asc';
      this.subjectPage = params['subjectPage'] ? Number(params['subjectPage']) : 1;
      this.subjectPageSize = params['subjectPageSize'] ? Number(params['subjectPageSize']) : 10;

      if (this.user) {
        this.loadTaskDistribution();
        if (this.isTaskModalOpen) {
          this.loadModalTasks();
        }
      }
    });

    this.checkUserPermissions();
  }

  private checkUserPermissions(): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const userId = this.jwtService.getUserIdFromToken(token);
    if (!userId) {
      this.isLoading = false;
      return;
    }

    this.userService.getUserById(userId).subscribe({
      next: (currentUser) => {
        this.currentUserRole = currentUser.role;
        this.isHOD = this.currentUserRole === 'HOD';

        if (this.isHOD) {
          this.currentUserDepartments = currentUser.departmentIds || [];
          this.verifyHODAccess();
        } else {
          this.loadUserDetails();
        }
      },
      error: () => {
        this.errorMessage = 'Failed to verify permissions';
        this.isLoading = false;
      }
    });
  }

  private verifyHODAccess(): void {
    this.userService.getUserById(this.userId).subscribe({
      next: (user) => {
        const userDeptIds = user.departmentIds || [];
        const hasAccess = userDeptIds.some(id => this.currentUserDepartments.includes(id));

        if (!hasAccess) {
          this.isForbidden = true;
          this.isLoading = false;
          return;
        }

        this.user = user;
        this.loadUserTasksAndDepts();
      },
      error: () => {
        this.isForbidden = true;
        this.isLoading = false;
      }
    });
  }

  loadUserDetails(): void {
    this.isLoading = true;
    this.userService.getUserById(this.userId).subscribe({
      next: (user) => {
        this.user = user;
        this.loadUserTasksAndDepts();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Failed to load user';
      }
    });
  }

  private loadUserTasksAndDepts(): void {
    forkJoin({
      tasks: this.taskService.getTasksByUser(this.userId),
      departments: this.deptService.getDepartmentsByIds(this.user?.departmentIds || [])
    }).subscribe({
      next: ({ tasks, departments }) => {
        this.userTasks = tasks.data || [];
        this.enrichedDepartments = departments || [];
        this.prepareDepartments();
        this.updateTaskStats();
        this.applyFilters();
        this.loadRecentActivity();
        this.loadTaskTypeSummary();
        this.loadTaskDistribution();
        if (this.isTaskModalOpen) {
          this.loadModalTasks();
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.isLoading = false;
      }
    });
  }

  /** The 5 default card definitions (always shown, count updated from API) */
  private readonly defaultTypeCards: TemplateTaskSummaryDto[] = [
    { templateTitle: 'Meeting Task', count: 0 },
    { templateTitle: 'Consultancy Task', count: 0 },
    { templateTitle: 'Visits Task', count: 0 },
    { templateTitle: 'Fees Task', count: 0 },
    { templateTitle: 'Forms Task', count: 0 },
  ];

  /** Fetch template-task-summary; always show 5 cards (merge with defaults) */
  private loadTaskTypeSummary(): void {
    this.loadingTypeSummary = true;
    this.userService.getUserTaskTemplateSummary(this.userId).subscribe({
      next: (data) => {
        const apiData = data || [];
        if (apiData.length > 0) {
          // API returned real data — use it directly
          this.taskTypeSummary = apiData;
        } else {
          // API returned empty — show defaults with count 0
          this.taskTypeSummary = [...this.defaultTypeCards];
        }
        this.loadingTypeSummary = false;
      },
      error: (err) => {
        console.warn('Could not load task type summary:', err);
        // On failure: try client-side fallback first, then defaults
        const fallback = this.buildFallbackTypeSummary();
        this.taskTypeSummary = fallback.length > 0 ? fallback : [...this.defaultTypeCards];
        this.loadingTypeSummary = false;
      }
    });
  }

  /** Fallback: group loaded tasks by their template title when API fails */
  private buildFallbackTypeSummary(): TemplateTaskSummaryDto[] {
    const countMap = new Map<string, number>();
    this.userTasks.forEach(t => {
      const title = t.template?.title || t.templateId?.toString() || 'Other';
      countMap.set(title, (countMap.get(title) || 0) + 1);
    });
    return Array.from(countMap.entries()).map(([templateTitle, count]) => ({ templateTitle, count }));
  }

  /** Returns Bootstrap icon class by matching keywords in templateTitle */
  getTypeIcon(templateTitle: string): string {
    const lower = templateTitle.toLowerCase();
    const match = this.typeKeywords.find(k => lower.includes(k.keyword));
    return match?.icon ?? 'bi-tag';
  }

  /** Returns CSS modifier class by matching keywords in templateTitle */
  getTypeCssClass(templateTitle: string): string {
    const lower = templateTitle.toLowerCase();
    const match = this.typeKeywords.find(k => lower.includes(k.keyword));
    return match?.cssClass ?? 'task-type-default';
  }

  /** The card label is simply the templateTitle returned by the API */
  getTypeLabel(summary: TemplateTaskSummaryDto): string {
    return summary.templateTitle;
  }

  /** Toggle task-type filter; clicking the active card again clears it */
  selectTaskType(templateTitle: string): void {
    this.taskTypeFilter = (this.taskTypeFilter === templateTitle) ? '' : templateTitle;
    this.setActiveTab('tasks');
    this.applyFilters();
  }

  private prepareDepartments(): void {
    this.enrichedDepartments = this.enrichedDepartments.map(dept => ({
      id: dept.departmentId || dept.id,
      name: dept.name,
      hodName: dept.users?.find((u: any) => u.role === 'HOD')?.fullName || 'Not Assigned',
      userCount: dept.users?.length || 0,
      color: this.getRandomColor()
    }));
  }

  private getRandomColor(): string {
    const colors = [
      'bg-gradient-to-r from-blue-500 to-cyan-400',
      'bg-gradient-to-r from-purple-500 to-pink-500',
      'bg-gradient-to-r from-emerald-500 to-teal-400',
      'bg-gradient-to-r from-amber-500 to-orange-400',
      'bg-gradient-to-r from-rose-500 to-pink-400',
      'bg-gradient-to-r from-indigo-500 to-purple-400'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private updateTaskStats(): void {
    this.taskStats = [
      { label: 'PENDING', count: this.userTasks.filter(t => t.status === 'PENDING').length, icon: 'bi-clock', color: '#F59E0B', gradient: 'from-amber-500 to-orange-500' },
      { label: 'UPCOMING', count: this.userTasks.filter(t => t.status === 'UPCOMING').length, icon: 'bi-calendar-event', color: '#0EA5E9', gradient: 'from-cyan-500 to-blue-500' },
      { label: 'DELAYED', count: this.userTasks.filter(t => t.status === 'DELAYED').length, icon: 'bi-exclamation-triangle', color: '#EF4444', gradient: 'from-red-500 to-pink-500' },
      { label: 'COMPLETED', count: this.userTasks.filter(t => t.status === 'CLOSED').length, icon: 'bi-check-circle', color: '#10B981', gradient: 'from-emerald-500 to-green-500' },
      { label: 'IN_PROGRESS', count: this.userTasks.filter(t => t.status === 'IN_PROGRESS').length, icon: 'bi-arrow-repeat', color: '#6366F1', gradient: 'from-indigo-500 to-purple-500' },
      { label: 'EXTENDED', count: this.userTasks.filter(t => t.status === 'EXTENDED').length, icon: 'bi-arrow-right-circle', color: '#6366F1', gradient: 'from-indigo-500 to-purple-500' },
      { label: 'REQUEST_FOR_EXTENSION', count: this.userTasks.filter(t => t.status === 'REQUEST_FOR_EXTENSION').length, icon: 'bi-question-circle', color: '#F59E0B', gradient: 'from-amber-500 to-orange-500' },
      { label: 'REQUEST_FOR_CLOSURE', count: this.userTasks.filter(t => t.status === 'REQUEST_FOR_CLOSURE').length, icon: 'bi-x-circle', color: '#EF4444', gradient: 'from-red-500 to-pink-500' }
    ];
  }

  getTaskStatusClass(status: string): string {
    const map: any = {
      'PENDING': 'task-status-pending',
      'UPCOMING': 'task-status-upcoming',
      'DELAYED': 'task-status-delayed',
      'CLOSED': 'task-status-closed',
      'IN_PROGRESS': 'task-status-in-progress'
    };
    return map[status] || 'task-status-default';
  }

  applyFiltersInternal(skipSync: boolean = false): void {
    this.filteredTasks = this.userTasks.filter(task => {
      const matchesSearch = !this.searchTerm ||
        task.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesStatus = !this.statusFilter || task.status === this.statusFilter;
      // Match against task.template?.title (the field the API populates on each task)
      const matchesTemplate = !this.taskTypeFilter ||
        (task.template?.title || '').toLowerCase() === this.taskTypeFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesTemplate;
    });
    this.totalPages = Math.ceil(this.filteredTasks.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    
    // Sync distribution status with task filter when filter changes
    if (!skipSync) {
      if (this.statusFilter) {
        const reverseMapping: { [key: string]: string } = {
          'CLOSED': 'COMPLETED'
        };
        this.selectedDistributionStatus = reverseMapping[this.statusFilter] || this.statusFilter;
      } else {
        this.selectedDistributionStatus = 'ALL';
      }
    }
  }

  applyFilters(): void {
    this.applyFiltersInternal(false);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.taskTypeFilter = '';
    this.selectedDistributionStatus = 'ALL';
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];

    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, this.currentPage - 2);
      let end = Math.min(this.totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) pages.push(i);
    }

    return pages;
  }

  get paginatedTasks(): TaskDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTasks.slice(start, start + this.pageSize);
  }

  applyFiltersLogs(): void {
    this.filteredLogs = this.userLogs.filter(log => {
      const matchesSearch = !this.searchTermLogs ||
        log.action?.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        log.entity?.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(this.searchTermLogs.toLowerCase()));
      return matchesSearch;
    });
    this.totalPagesLogs = Math.ceil(this.filteredLogs.length / this.pageSizeLogs) || 1;
    if (this.currentPageLogs > this.totalPagesLogs) this.currentPageLogs = 1;
  }

  resetFiltersLogs(): void {
    this.searchTermLogs = '';
    this.applyFiltersLogs();
  }

  changePageLogs(page: number): void {
    if (page >= 1 && page <= this.totalPagesLogs) {
      this.currentPageLogs = page;
    }
  }

  getPageNumbersLogs(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];

    if (this.totalPagesLogs <= maxVisible) {
      for (let i = 1; i <= this.totalPagesLogs; i++) pages.push(i);
    } else {
      let start = Math.max(1, this.currentPageLogs - 2);
      let end = Math.min(this.totalPagesLogs, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) pages.push(i);
    }

    return pages;
  }

  get paginatedLogs(): AuditLog[] {
    const start = (this.currentPageLogs - 1) * this.pageSizeLogs;
    return this.filteredLogs.slice(start, start + this.pageSizeLogs);
  }

  private loadRecentActivity(): void {
    this.loadingLogs = true;
    this.auditLogService.getLogsByUser(this.userId).subscribe({
      next: (logs) => {
        this.userLogs = logs || [];
        this.recentActivity = this.userLogs.slice(0, 5).map(log => ({
          action: log.action,
          entity: log.entity,
          timestamp: log.timestamp,
          icon: this.getActivityIcon(log.action),
          color: this.getActivityColor(log.action)
        }));
        this.applyFiltersLogs();
        this.loadingLogs = false;
      },
      error: (err) => {
        console.error('Error loading logs:', err);
        this.userLogs = [];
        this.loadingLogs = false;
      }
    });
  }
  get startIndex(): number {
    return this.filteredTasks.length
      ? (this.currentPage - 1) * this.pageSize + 1
      : 0;
  }

  get endIndex(): number {
    return Math.min(
      this.currentPage * this.pageSize,
      this.filteredTasks.length
    );
  }
  formatTime(timestamp: string | Date): string {
    if (!timestamp) return '';

    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }


  getActivityIcon(action: string): string {
    const map: any = {
      'CREATE': 'bi-plus-circle',
      'UPDATE': 'bi-pencil-square',
      'DELETE': 'bi-trash',
      'LOGIN': 'bi-box-arrow-in-right',
      'LOGOUT': 'bi-box-arrow-right',
      'COMPLETE': 'bi-check-circle'
    };
    return map[action] || 'bi-activity';
  }

  getActivityColor(action: string): string {
    const map: any = {
      'CREATE': 'text-emerald-600 bg-emerald-50',
      'UPDATE': 'text-blue-600 bg-blue-50',
      'DELETE': 'text-red-600 bg-red-50',
      'LOGIN': 'text-purple-600 bg-purple-50',
      'LOGOUT': 'text-gray-600 bg-gray-50',
      'COMPLETE': 'text-green-600 bg-green-50'
    };
    return map[action] || 'text-gray-600 bg-gray-50';
  }

  setActiveTab(tab: 'tasks' | 'departments' | 'logs'): void {
    this.activeTab = tab;
    if (tab === 'logs' && this.userLogs.length === 0) {
      this.loadRecentActivity();
    }
  }

  goBack(): void {
    this.router.navigate(['/viewAllUsers']);
  }

  assignNewTask(): void {
    this.router.navigate(['/add-task'], { queryParams: { userId: this.userId } });
  }

  viewDepartment(deptId: any): void {
    this.router.navigate(['/department', deptId]);
  }

  viewTask(taskId: number): void {
    this.router.navigate(['/task', taskId]);
  }

  canEditDelete(): boolean {
    return !this.isHOD && this.currentUserRole !== 'USER';
  }

  editUser(): void {
    if (this.canEditDelete()) {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.isEditModalOpen = true;
      this.closeSidebarForModal();
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
      // this.suppressSidebarZIndex();
    }
  }

  closeEditModal(saved: boolean): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.isEditModalOpen = false;
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    this.restoreSidebarZIndex();
    this.restoreSidebar();
    if (saved) {
      this.loadUserDetails();
    }
  }

  deleteUser(): void {
    if (!this.canEditDelete()) return;

    this.confirmDialog.confirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {
      if (!confirmed) return;
      this.userService.deleteUser(this.userId).subscribe({
        next: () => {
          this.goBack();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to delete user';
        }
      });
    });
  }

  toggleUserStatus(): void {
    if (!this.canEditDelete() || !this.userId) return;

    const action = this.user?.status === 'ACTIVE' ? 'deactivate' : 'activate';
    const actionLabel = this.user?.status === 'ACTIVE' ? 'Deactivate' : 'Activate';

    this.confirmDialog.confirm({
      title: `${actionLabel} User`,
      message: `Are you sure you want to ${action} this user?`,
      confirmText: actionLabel,
      cancelText: 'Cancel',
      type: this.user?.status === 'ACTIVE' ? 'danger' : 'warning'
    }).then(confirmed => {
      if (!confirmed) return;
      this.userService.toggleUserStatus(this.userId).subscribe({
        next: (res: any) => {
          if (res && res.data && res.data.status && this.user) {
            this.user.status = res.data.status;
          } else {
            this.loadUserDetails();
          }
        },
        error: (err: any) => {
          console.error('Failed to toggle user status:', err);
          this.errorMessage = err?.error?.message || err?.message || 'Failed to update user status.';
        }
      });
    });
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getGroupedSubjects(): any[] {
    if (!this.user || !this.user.subjects || this.user.subjects.length === 0) {
      return [];
    }
    const groups: { [key: string]: { departmentName: string, subDepartmentName: string, subjects: any[] } } = {};
    this.user.subjects.forEach(sub => {
      const key = `${sub.departmentName || ''}_${sub.subDepartmentName || ''}`;
      if (!groups[key]) {
        groups[key] = {
          departmentName: sub.departmentName || 'Other',
          subDepartmentName: sub.subDepartmentName || '',
          subjects: []
        };
      }
      groups[key].subjects.push(sub);
    });
    return Object.values(groups);
  }

  loadTaskDistribution(): void {
    this.loadingDistribution = true;

    // Save focused element — restore after DOM settles post-API
    const focusedEl = document.activeElement as HTMLElement;

    const params = {
      departmentSearch: this.departmentSearch,
      subDepartmentSearch: this.subDepartmentSearch,
      subjectSearch: this.subjectSearch,
      sortByDept: this.departmentSortBy,
      sortDirDept: this.departmentSortDir,
      sortBySubDept: this.subDepartmentSortBy,
      sortDirSubDept: this.subDepartmentSortDir,
      sortBySubject: this.subjectSortBy,
      sortDirSubject: this.subjectSortDir,
      deptPage: this.deptPage - 1,
      deptSize: this.deptPageSize,
      subDeptPage: this.subDeptPage - 1,
      subDeptSize: this.subDeptPageSize,
      subjectPage: this.subjectPage - 1,
      subjectSize: this.subjectPageSize
    };

    this.userService.getUserTaskDistribution(this.userId, params).subscribe({
      next: (res) => {
        this.taskDistribution = res;
        this.hasDistributionAccess = true;
        this.loadingDistribution = false;
        this.deptTotal = res.departmentTotalElements || 0;
        this.subDeptTotal = res.subDepartmentTotalElements || 0;
        this.subjectTotal = res.subjectTotalElements || 0;
        this.updateDistributionStatsCards();
        // Restore focus after Angular re-renders
        setTimeout(() => { focusedEl?.focus(); }, 50);
      },
      error: (err) => {
        console.warn('Failed to load user task distribution:', err);
        this.hasDistributionAccess = false;
        this.loadingDistribution = false;
        setTimeout(() => { focusedEl?.focus(); }, 50);
      }
    });
  }

  updateDistributionStatsCards(): void {
    if (!this.taskDistribution || !this.taskDistribution.overview) return;
    const overview = this.taskDistribution.overview;
    this.distributionStatsCards = [
      { key: 'ALL', label: 'Total Assigned', count: overview.totalTasks, icon: 'bi-grid-fill', color: 'primary' },
      { key: 'PENDING', label: 'Pending', count: overview.pending, icon: 'bi-clock', color: 'warning' },
      { key: 'IN_PROGRESS', label: 'In Progress', count: overview.inProgress, icon: 'bi-play-circle', color: 'info' },
      { key: 'COMPLETED', label: 'Completed', count: overview.completed, icon: 'bi-check-circle', color: 'success' },
      { key: 'DELAYED', label: 'Delayed', count: overview.delayed, icon: 'bi-exclamation-triangle', color: 'danger' },
      { key: 'UPCOMING', label: 'Upcoming', count: overview.upcoming, icon: 'bi-calendar-event', color: 'secondary' },
      { key: 'EXTENDED', label: 'Extended', count: overview.extended, icon: 'bi-arrow-right-circle', color: 'primary' },
      { key: 'REQUEST_FOR_EXTENSION', label: 'Request For Extension', count: overview.requestForExtension, icon: 'bi-question-circle', color: 'warning' },
      { key: 'REQUEST_FOR_CLOSURE', label: 'Request For Closure', count: overview.requestForClosure, icon: 'bi-x-circle', color: 'danger' }
    ];
  }

  selectDistributionStatus(statusKey: string): void {
    const isDeselecting = this.selectedDistributionStatus === statusKey;
    
    if (isDeselecting) {
      this.selectedDistributionStatus = 'ALL';
      this.statusFilter = '';
    } else {
      this.selectedDistributionStatus = statusKey;
      // Map distribution card keys to task status values
      if (statusKey === 'COMPLETED') {
        this.statusFilter = 'CLOSED';
      } else if (statusKey === 'ALL') {
        this.statusFilter = '';
      } else {
        this.statusFilter = statusKey;
      }
    }
    
    this.setActiveTab('tasks');
    this.applyFiltersInternal(true); // Skip sync to avoid loop
    this.updateQueryParams();
  }

  getFilteredDepartments() {
    return this.taskDistribution ? this.taskDistribution.departmentDistribution || [] : [];
  }

  getFilteredSubDepartments() {
    return this.taskDistribution ? this.taskDistribution.subDepartmentDistribution || [] : [];
  }

  getFilteredSubjects() {
    return this.taskDistribution ? this.taskDistribution.subjectDistribution || [] : [];
  }

  getStatusCountKey(status: string): string {
    switch (status) {
      case 'PENDING': return 'pending';
      case 'IN_PROGRESS': return 'inProgress';
      case 'COMPLETED': return 'completed';
      case 'DELAYED': return 'delayed';
      case 'UPCOMING': return 'upcoming';
      case 'EXTENDED': return 'extended';
      case 'REQUEST_FOR_EXTENSION': return 'requestForExtension';
      case 'REQUEST_FOR_CLOSURE': return 'requestForClosure';
      case 'RECURRING_PARENT': return 'recurringParent';
      default: return 'totalTasks';
    }
  }

  openUserTasks(statusFilter: string = 'ALL'): void {
    this.modalTargetType = 'all';
    this.modalTargetId = this.userId;
    this.modalTargetName = 'All Assigned Tasks';
    this.modalStatus = statusFilter;
    this.modalPage = 1;
    this.modalSearch = '';
    this.modalPriority = '';
    this.modalTaskType = '';
    this.isTaskModalOpen = true;
    this.closeSidebarForModal();
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    this.updateQueryParams();
    this.loadModalTasks();
  }

  openDepartmentTasks(dept: any, statusFilter: string = 'ALL'): void {
    this.modalTargetType = 'department';
    this.modalTargetId = dept.departmentId;
    this.modalTargetName = dept.departmentName;
    this.modalStatus = statusFilter;
    this.modalPage = 1;
    this.modalSearch = '';
    this.modalPriority = '';
    this.modalTaskType = '';
    this.isTaskModalOpen = true;
    this.closeSidebarForModal();
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    this.updateQueryParams();
    this.loadModalTasks();
  }

  openSubDepartmentTasks(subDept: any, statusFilter: string = 'ALL'): void {
    this.modalTargetType = 'subdepartment';
    this.modalTargetId = subDept.subDepartmentId;
    this.modalTargetName = subDept.subDepartmentName;
    this.modalStatus = statusFilter;
    this.modalPage = 1;
    this.modalSearch = '';
    this.modalPriority = '';
    this.modalTaskType = '';
    this.isTaskModalOpen = true;
    this.closeSidebarForModal();
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    this.updateQueryParams();
    this.loadModalTasks();
  }

  loadModalTasks(): void {
    if (!this.modalTargetType || !this.modalTargetId) return;
    this.modalLoading = true;

    // Save focused element — restore after DOM settles post-API
    const focusedEl = document.activeElement as HTMLElement;

    const params = {
      page: this.modalPage - 1,
      size: this.modalPageSize,
      sortBy: this.modalSortBy,
      sortDirection: this.modalSortDir,
      search: this.modalSearch,
      status: this.modalStatus !== 'ALL' ? this.modalStatus : '',
      priority: this.modalPriority,
      taskType: this.modalTaskType
    };

    const request = this.modalTargetType === 'department'
      ? this.userService.getUserDepartmentTasks(this.userId, this.modalTargetId, params)
      : this.modalTargetType === 'subdepartment'
        ? this.userService.getUserSubDepartmentTasks(this.userId, this.modalTargetId, params)
        : this.userService.getUserTasks(this.userId, params);

    request.subscribe({
      next: (res: any) => {
        this.modalTasks = res.content || [];
        this.modalTotalTasks = res.totalElements || 0;
        this.modalLoading = false;
        // Restore focus after Angular re-renders
        setTimeout(() => { focusedEl?.focus(); }, 50);
      },
      error: (err) => {
        console.error('Error loading modal tasks', err);
        this.modalLoading = false;
        setTimeout(() => { focusedEl?.focus(); }, 50);
      }
    });
  }

  onModalSearchChange(value: string): void {
    this._modalSearch$.next(value);
  }

  onModalStatusChange(status: string): void {
    this.modalStatus = status;
    this.modalPage = 1;
    this.updateQueryParams();
  }

  changeModalPage(page: number): void {
    this.modalPage = page;
    this.updateQueryParams();
  }

  closeTaskModal(): void {
    this.isTaskModalOpen = false;
    this.modalTasks = [];
    this.restoreSidebarZIndex();
    this.updateQueryParams();
  }

  sortModalBy(column: string): void {
    if (this.modalSortBy === column) {
      this.modalSortDir = this.modalSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.modalSortBy = column;
      this.modalSortDir = 'desc';
    }
    this.modalPage = 1;
    this.updateQueryParams();
  }

  exportModalTasks(format: string): void {
    if (!this.modalTargetType || !this.modalTargetId) return;
    const params = {
      format: format,
      search: this.modalSearch,
      status: this.modalStatus !== 'ALL' ? this.modalStatus : '',
      priority: this.modalPriority,
      taskType: this.modalTaskType
    };

    const url = this.modalTargetType === 'department'
      ? this.userService.getExportUserDepartmentTasksUrl(this.userId, this.modalTargetId, params)
      : this.modalTargetType === 'subdepartment'
        ? this.userService.getExportUserSubDepartmentTasksUrl(this.userId, this.modalTargetId, params)
        : this.userService.getExportUserTasksUrl(this.userId, params);

    window.open(url, '_blank');
  }

  getModalTotalPages(): number {
    return Math.ceil(this.modalTotalTasks / this.modalPageSize) || 1;
  }

  updateQueryParams(): void {
    const queryParams: any = {
      modalType: this.isTaskModalOpen ? this.modalTargetType : null,
      modalId: this.isTaskModalOpen ? this.modalTargetId : null,
      modalName: this.isTaskModalOpen ? this.modalTargetName : null,
      modalStatus: this.isTaskModalOpen ? this.modalStatus : null,
      modalSearch: this.isTaskModalOpen ? this.modalSearch : null,
      modalPage: this.isTaskModalOpen ? this.modalPage : null,
      modalSortBy: this.isTaskModalOpen ? this.modalSortBy : null,
      modalSortDir: this.isTaskModalOpen ? this.modalSortDir : null,
      distStatus: this.selectedDistributionStatus !== 'ALL' ? this.selectedDistributionStatus : null,
      deptSearch: this.departmentSearch || null,
      deptSortBy: this.departmentSortBy !== 'departmentName' ? this.departmentSortBy : null,
      deptSortDir: this.departmentSortDir !== 'asc' ? this.departmentSortDir : null,
      deptPage: this.deptPage > 1 ? this.deptPage : null,
      deptPageSize: this.deptPageSize !== 10 ? this.deptPageSize : null,
      subDeptSearch: this.subDepartmentSearch || null,
      subDeptSortBy: this.subDepartmentSortBy !== 'subDepartmentName' ? this.subDepartmentSortBy : null,
      subDeptSortDir: this.subDepartmentSortDir !== 'asc' ? this.subDepartmentSortDir : null,
      subDeptPage: this.subDeptPage > 1 ? this.subDeptPage : null,
      subDeptPageSize: this.subDeptPageSize !== 10 ? this.subDeptPageSize : null,
      subjectSearch: this.subjectSearch || null,
      subjectSortBy: this.subjectSortBy !== 'subjectName' ? this.subjectSortBy : null,
      subjectSortDir: this.subjectSortDir !== 'asc' ? this.subjectSortDir : null,
      subjectPage: this.subjectPage > 1 ? this.subjectPage : null,
      subjectPageSize: this.subjectPageSize !== 10 ? this.subjectPageSize : null
    };

    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === null || queryParams[key] === undefined || queryParams[key] === '') {
        // Set to undefined so Angular's merge mode removes the param from the URL
        queryParams[key] = undefined;
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  onDepartmentSearch(value: string): void {
    this._deptSearch$.next(value);
  }

  sortDepartment(column: string): void {
    if (this.departmentSortBy === column) {
      this.departmentSortDir = this.departmentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.departmentSortBy = column;
      this.departmentSortDir = 'asc';
    }
    this.deptPage = 1;
    this.updateQueryParams();
  }

  changeDeptPage(page: number): void {
    this.deptPage = page;
    this.updateQueryParams();
  }

  onSubDepartmentSearch(value: string): void {
    this._subDeptSearch$.next(value);
  }

  sortSubDepartment(column: string): void {
    if (this.subDepartmentSortBy === column) {
      this.subDepartmentSortDir = this.subDepartmentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.subDepartmentSortBy = column;
      this.subDepartmentSortDir = 'asc';
    }
    this.subDeptPage = 1;
    this.updateQueryParams();
  }

  changeSubDeptPage(page: number): void {
    this.subDeptPage = page;
    this.updateQueryParams();
  }

  onSubjectSearch(value: string): void {
    this._subjectSearch$.next(value);
  }

  sortSubject(column: string): void {
    if (this.subjectSortBy === column) {
      this.subjectSortDir = this.subjectSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.subjectSortBy = column;
      this.subjectSortDir = 'asc';
    }
    this.subjectPage = 1;
    this.updateQueryParams();
  }

  changeSubjectPage(page: number): void {
    this.subjectPage = page;
    this.updateQueryParams();
  }

  exportTaskDistribution(type: string, format: string): void {
    const params = {
      type,
      format,
      search: type === 'DEPARTMENT' ? this.departmentSearch : type === 'SUB_DEPARTMENT' ? this.subDepartmentSearch : this.subjectSearch,
      sortBy: type === 'DEPARTMENT' ? this.departmentSortBy : type === 'SUB_DEPARTMENT' ? this.subDepartmentSortBy : this.subjectSortBy,
      sortDir: type === 'DEPARTMENT' ? this.departmentSortDir : type === 'SUB_DEPARTMENT' ? this.subDepartmentSortDir : this.subjectSortDir
    };
    const url = this.userService.getExportTaskDistributionUrl(this.userId, params);
    window.open(url, '_blank');
  }

  getModalTotalPagesArray(): number[] {
    const total = this.getModalTotalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  getDeptTotalPages(): number {
    return Math.ceil(this.deptTotal / this.deptPageSize) || 1;
  }

  getDeptTotalPagesArray(): number[] {
    return Array.from({ length: this.getDeptTotalPages() }, (_, i) => i + 1);
  }

  getSubDeptTotalPages(): number {
    return Math.ceil(this.subDeptTotal / this.subDeptPageSize) || 1;
  }

  getSubDeptTotalPagesArray(): number[] {
    return Array.from({ length: this.getSubDeptTotalPages() }, (_, i) => i + 1);
  }

  getSubjectTotalPages(): number {
    return Math.ceil(this.subjectTotal / this.subjectPageSize) || 1;
  }

  getSubjectTotalPagesArray(): number[] {
    return Array.from({ length: this.getSubjectTotalPages() }, (_, i) => i + 1);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
  }
}
