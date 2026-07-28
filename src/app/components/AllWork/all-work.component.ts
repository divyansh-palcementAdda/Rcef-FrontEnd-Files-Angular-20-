import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import { 
  AllWorkApiService, 
  WorkDashboardResponse, 
  DepartmentCardDTO, 
  SubDepartmentRowDTO, 
  UserRowDTO, 
  WorkAnalyticsResponse 
} from '../../Services/all-work-api.service';
import { JwtService } from '../../Services/jwt-service';
import { ModalWrapperComponent } from '../Shared/modal-wrapper/modal-wrapper';
import { ModalWrapperService } from '../../Services/modal-wrapper.service';
import { AllWorkUsersComponent } from './modals/users/all-work-users.component';
import { AllWorkTasksComponent } from './modals/tasks/all-work-tasks.component';
import { AllWorkAnalyticsComponent } from './modals/analytics/all-work-analytics.component';

@Component({
  selector: 'app-all-work',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ModalWrapperComponent, 
    AllWorkUsersComponent, 
    AllWorkTasksComponent, 
    AllWorkAnalyticsComponent
  ],
  templateUrl: './all-work.component.html',
  styleUrls: ['./all-work.component.css']
})
export class AllWorkComponent implements OnInit, OnDestroy {
  Math = Math;

  // Current User Info
  currentUserId: number | null = null;
  role: string = '';
  
  // Dashboard & Department Cards
  dashboardData: WorkDashboardResponse | null = null;
  departments: DepartmentCardDTO[] = [];
  selectedDeptId: number | null = null;
  loadingDashboard = false;

  // Sub Department Grid
  subDepartments: SubDepartmentRowDTO[] = [];
  totalSubDepts = 0;
  subDeptSearch = '';
  subDeptPage = 0;
  subDeptSize = 10;
  subDeptSort = 'name,asc';
  loadingSubDepts = false;
  subDeptError = false;

  // Modal-specific grid state tracking
  userSearch = '';
  userPage = 0;
  userSize = 10;
  userSort = 'fullName,asc';
  taskSearch = '';
  taskStatus = 'ALL';
  taskPage = 0;
  taskSize = 10;
  taskSort = 'createdAt,desc';

  // Sort tracking for UI indicators
  subDeptSortField = 'name';
  subDeptSortDir: 'asc' | 'desc' = 'asc';
  showFilters = false;
  exportDropdownOpen = false;

  // Search debouncing subject
  private subDeptSearchSubject = new Subject<string>();

  // Backend filters for Sub Departments
  filterTaskStatus = '';
  filterUserCountMin: number | null = null;
  filterUserCountMax: number | null = null;
  filterSubjectCountMin: number | null = null;
  filterSubjectCountMax: number | null = null;
  filterCreatedDateStart = '';
  filterCreatedDateEnd = '';
  filterLastActivityStart = '';
  filterLastActivityEnd = '';
  filterDeptStatus = '';
  filterCreatedBy = '';

  isInitialLoad = true;
  private subscriptions = new Subscription();
  // Guard to ignore fast clicks immediately after modal close
  private ignoreClicksUntil = 0;

  constructor(
    private apiService: AllWorkApiService,
    private jwtService: JwtService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    public modalWrapperService: ModalWrapperService,
    private location: Location
  ) {}

  ngOnInit(): void {
    const token = this.jwtService.getAccessToken();
    this.currentUserId = token ? this.jwtService.getUserIdFromToken(token) : null;
    
    // Subscribe to search input changes with debounce
    this.subscriptions.add(
      this.subDeptSearchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(value => {
        this.subDeptSearch = value;
        this.subDeptPage = 0;
        this.updateQueryParams();
        this.loadSubDepartments();
      })
    );

    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        // Restore state from query parameters (handles browser back navigation)
        if (params['dept'] !== undefined) this.selectedDeptId = params['dept'] ? parseInt(params['dept'], 10) : null;
        if (params['subDeptSearch'] !== undefined) this.subDeptSearch = params['subDeptSearch'] || '';
        if (params['subDeptPage'] !== undefined) this.subDeptPage = parseInt(params['subDeptPage'], 10) || 0;
        if (params['subDeptSize'] !== undefined) this.subDeptSize = parseInt(params['subDeptSize'], 10) || 10;
        if (params['subDeptSort'] !== undefined) {
          this.subDeptSort = params['subDeptSort'] || 'name,asc';
          const parts = this.subDeptSort.split(',');
          this.subDeptSortField = parts[0] || 'name';
          this.subDeptSortDir = (parts[1] === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
        }

        // Restore filters from query params
        this.filterTaskStatus = params['filterTaskStatus'] || '';
        this.filterUserCountMin = params['filterUserCountMin'] ? parseInt(params['filterUserCountMin'], 10) : null;
        this.filterUserCountMax = params['filterUserCountMax'] ? parseInt(params['filterUserCountMax'], 10) : null;
        this.filterSubjectCountMin = params['filterSubjectCountMin'] ? parseInt(params['filterSubjectCountMin'], 10) : null;
        this.filterSubjectCountMax = params['filterSubjectCountMax'] ? parseInt(params['filterSubjectCountMax'], 10) : null;
        this.filterCreatedDateStart = params['filterCreatedDateStart'] || '';
        this.filterCreatedDateEnd = params['filterCreatedDateEnd'] || '';
        this.filterLastActivityStart = params['filterLastActivityStart'] || '';
        this.filterLastActivityEnd = params['filterLastActivityEnd'] || '';
        this.filterDeptStatus = params['filterDeptStatus'] || '';
        this.filterCreatedBy = params['filterCreatedBy'] || '';

        if (params['userSearch'] !== undefined) this.userSearch = params['userSearch'] || '';
        if (params['userPage'] !== undefined) this.userPage = parseInt(params['userPage'], 10) || 0;
        if (params['userSize'] !== undefined) this.userSize = parseInt(params['userSize'], 10) || 10;
        if (params['userSort'] !== undefined) this.userSort = params['userSort'] || 'fullName,asc';
        if (params['taskSearch'] !== undefined) this.taskSearch = params['taskSearch'] || '';
        if (params['taskStatus'] !== undefined) this.taskStatus = params['taskStatus'] || 'ALL';
        if (params['taskPage'] !== undefined) this.taskPage = parseInt(params['taskPage'], 10) || 0;
        if (params['taskSize'] !== undefined) this.taskSize = parseInt(params['taskSize'], 10) || 10;
        if (params['taskSort'] !== undefined) this.taskSort = params['taskSort'] || 'createdAt,desc';

        // Restore modal state
        const subDeptId = params['subDeptId'];
        const userId = params['userId'] ? parseInt(params['userId'], 10) : null;
        const modal = params['modal'];

        if (modal) {
          const subDept = subDeptId ? ({ id: subDeptId } as SubDepartmentRowDTO) : null;
          const user = userId ? ({ userId } as UserRowDTO) : null;

          if (modal === 'users' && subDept) {
            this.modalWrapperService.setStack([
              {
                component: AllWorkUsersComponent,
                config: {
                  title: `Users in ${subDept.name || ''}`,
                  subtitle: 'Manage, search, and monitor user workloads.',
                  sizeClass: 'modal-xl',
                  data: {
                    subDept: subDept,
                    dashboardData: this.dashboardData,
                    onOpenUserTasks: (u: UserRowDTO) => this.openUserTasks(u),
                    onOpenUserAnalytics: (u: UserRowDTO) => this.openUserAnalytics(u),
                    onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
                  }
                }
              }
            ]);
          } else if (modal === 'tasks') {
            const tasksTitle = user ? `Tasks assigned to ${user.fullName || ''}` : `Tasks in ${subDept?.name || ''}`;
            const tasksConfig = {
              title: tasksTitle,
              subtitle: 'Centralized task lifecycle oversight, priority tracking, and export.',
              sizeClass: 'modal-xl',
              data: {
                subDept: subDept,
                user: user,
                dashboardData: this.dashboardData,
                onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
              }
            };

            if (user && subDept) {
              this.modalWrapperService.setStack([
                {
                  component: AllWorkUsersComponent,
                  config: {
                    title: `Users in ${subDept.name || ''}`,
                    subtitle: 'Manage, search, and monitor user workloads.',
                    sizeClass: 'modal-xl',
                    data: {
                      subDept: subDept,
                      dashboardData: this.dashboardData,
                      onOpenUserTasks: (u: UserRowDTO) => this.openUserTasks(u),
                      onOpenUserAnalytics: (u: UserRowDTO) => this.openUserAnalytics(u),
                      onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
                    }
                  }
                },
                {
                  component: AllWorkTasksComponent,
                  config: tasksConfig
                }
              ]);
            } else {
              this.modalWrapperService.setStack([{ component: AllWorkTasksComponent, config: tasksConfig }]);
            }
          } else if (modal === 'analytics') {
            const analyticsTitle = user ? `Analytics Overview for ${user.fullName || ''}` : `Analytics Overview for ${subDept?.name || ''}`;
            const analyticsConfig = {
              title: analyticsTitle,
              subtitle: 'Granular work distribution, task states, and performance metrics.',
              sizeClass: 'modal-lg',
              data: {
                subDept: subDept,
                user: user
              }
            };

            if (user && subDept) {
              this.modalWrapperService.setStack([
                {
                  component: AllWorkUsersComponent,
                  config: {
                    title: `Users in ${subDept.name || ''}`,
                    subtitle: 'Manage, search, and monitor user workloads.',
                    sizeClass: 'modal-xl',
                    data: {
                      subDept: subDept,
                      dashboardData: this.dashboardData,
                      onOpenUserTasks: (u: UserRowDTO) => this.openUserTasks(u),
                      onOpenUserAnalytics: (u: UserRowDTO) => this.openUserAnalytics(u),
                      onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
                    }
                  }
                },
                {
                  component: AllWorkAnalyticsComponent,
                  config: analyticsConfig
                }
              ]);
            } else {
              this.modalWrapperService.setStack([{ component: AllWorkAnalyticsComponent, config: analyticsConfig }]);
            }
          }
        } else {
          this.modalWrapperService.clear();
        }

        // Load dashboard data on initial load or when department changes
        if (this.isInitialLoad) {
          this.isInitialLoad = false;
          this.loadDashboard(params);
        } else if (this.dashboardData) {
          // On subsequent navigation (browser back), reload data if needed
          if (this.role === 'SUPER_ADMIN' || this.role === 'ADMIN' || this.role === 'SUB_ADMIN') {
            if (this.selectedDeptId !== null) {
              this.loadSubDepartments();
            }
          } else if (this.role === 'HOD') {
            this.loadSubDepartments();
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // =========================================================================
  // API LOAD METHODS
  // =========================================================================

  loadDashboard(params: any = {}): void {
    this.loadingDashboard = true;
    this.cdr.markForCheck(); // Signal change detection for OnPush
    this.subscriptions.add(
      this.apiService.getDashboardData()
        .pipe(finalize(() => {
          this.loadingDashboard = false;
          this.cdr.markForCheck();
        }))
        .subscribe({
          next: (res) => {
            this.dashboardData = res;
            this.role = res.role;
            this.departments = res.departments || [];
            
            if (this.role === 'SUPER_ADMIN' || this.role === 'ADMIN' || this.role === 'SUB_ADMIN') {
              // Only set default department if not already set from query params
              if (this.selectedDeptId === null && res.defaultId) {
                this.selectedDeptId = parseInt(res.defaultId, 10);
              }
              this.loadSubDepartments();
            } else if (this.role === 'HOD') {
              this.loadSubDepartments();
            } else if (this.role === 'TEACHER') {
              if (this.currentUserId) {
                this.openUserTasksDirectly(this.currentUserId);
              }
            }
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('Failed to load work dashboard data', err);
            this.cdr.markForCheck();
          }
        })
    );
  }

  updateQueryParams(): void {
    const currentModal = this.modalWrapperService.getCurrentModal();
    const queryParams: any = {
      dept: this.selectedDeptId,
      subDeptSearch: this.subDeptSearch || null,
      subDeptPage: this.subDeptPage || null,
      subDeptSize: this.subDeptSize || null,
      subDeptSort: this.subDeptSort || null,

      filterTaskStatus: this.filterTaskStatus || null,
      filterUserCountMin: this.filterUserCountMin || null,
      filterUserCountMax: this.filterUserCountMax || null,
      filterSubjectCountMin: this.filterSubjectCountMin || null,
      filterSubjectCountMax: this.filterSubjectCountMax || null,
      filterCreatedDateStart: this.filterCreatedDateStart || null,
      filterCreatedDateEnd: this.filterCreatedDateEnd || null,
      filterLastActivityStart: this.filterLastActivityStart || null,
      filterLastActivityEnd: this.filterLastActivityEnd || null,
      filterDeptStatus: this.filterDeptStatus || null,
      filterCreatedBy: this.filterCreatedBy || null,

      modal: currentModal ? (currentModal.component === AllWorkUsersComponent ? 'users' : currentModal.component === AllWorkTasksComponent ? 'tasks' : 'analytics') : null,
      subDeptId: currentModal?.config.data?.subDept?.id || null,
      userId: currentModal?.config.data?.user?.userId || null
    };

    // When there is no active modal we must explicitly include the modal-related keys
    // (set to null) so that `queryParamsHandling: 'merge'` will remove any stale modal
    // flags from the URL. For other keys, remove empty/null values to keep the URL clean.
    const modalKeys = ['modal', 'subDeptId', 'userId'];
    if (!currentModal) {
      queryParams.modal = null;
      queryParams.subDeptId = null;
      queryParams.userId = null;
    }

    Object.keys(queryParams).forEach(key => {
      if (modalKeys.includes(key)) return; // keep modal keys even if null
      if (queryParams[key] === null || queryParams[key] === undefined || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  navigateToEntity(type: string, id: any, event?: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      const currentTarget = event.currentTarget as HTMLElement | null;
      const isInteractiveElement = !!target?.closest('button, a, input, select, textarea, [role="button"], .btn, .dropdown-item, .dropdown-toggle');
      const isDirectButtonAction = currentTarget?.tagName === 'BUTTON' || currentTarget?.getAttribute('role') === 'button';

      if (isInteractiveElement && !isDirectButtonAction) {
        return;
      }

      const mouseEvent = event as MouseEvent;
      const keyboardEvent = event as KeyboardEvent;
      const isCtrlClick = (mouseEvent && (mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.button === 1)) ||
                          (keyboardEvent && (keyboardEvent.ctrlKey || keyboardEvent.metaKey));

      if (isCtrlClick) {
        let url = '';
        if (type === 'task') url = `/task/${id}`;
        else if (type === 'user') url = `/user/${id}`;
        else if (type === 'sub-department') url = `/sub-department-details/${id}`;
        else if (type === 'department') url = `/department/${id}`;

        if (url) {
          window.open(url, '_blank');
          return;
        }
      }
    }

    this.updateQueryParams();

    if (type === 'task') {
      this.router.navigate(['/task', id]);
    } else if (type === 'user') {
      this.router.navigate(['/user', id]);
    } else if (type === 'sub-department') {
      this.router.navigate(['/sub-department-details', id]);
    } else if (type === 'department') {
      this.router.navigate(['/department', id]);
    }
  }

  selectDepartment(deptId: number): void {
    // ignore clicks immediately after modal close to prevent accidental modal open
    if (Date.now() < this.ignoreClicksUntil) return;

    this.selectedDeptId = deptId;
    this.subDeptPage = 0;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  getSerializedFilters(): string {
    const activeFilters: any = {};
    if (this.filterTaskStatus && this.filterTaskStatus !== 'ALL') {
      activeFilters.taskStatus = this.filterTaskStatus;
    }
    if (this.filterUserCountMin !== null && this.filterUserCountMin !== undefined && (this.filterUserCountMin as any) !== '') {
      activeFilters.userCountMin = this.filterUserCountMin;
    }
    if (this.filterUserCountMax !== null && this.filterUserCountMax !== undefined && (this.filterUserCountMax as any) !== '') {
      activeFilters.userCountMax = this.filterUserCountMax;
    }
    if (this.filterSubjectCountMin !== null && this.filterSubjectCountMin !== undefined && (this.filterSubjectCountMin as any) !== '') {
      activeFilters.subjectCountMin = this.filterSubjectCountMin;
    }
    if (this.filterSubjectCountMax !== null && this.filterSubjectCountMax !== undefined && (this.filterSubjectCountMax as any) !== '') {
      activeFilters.subjectCountMax = this.filterSubjectCountMax;
    }
    if (this.filterCreatedDateStart) {
      activeFilters.createdDateStart = this.filterCreatedDateStart;
    }
    if (this.filterCreatedDateEnd) {
      activeFilters.createdDateEnd = this.filterCreatedDateEnd;
    }
    if (this.filterLastActivityStart) {
      activeFilters.lastActivityStart = this.filterLastActivityStart;
    }
    if (this.filterLastActivityEnd) {
      activeFilters.lastActivityEnd = this.filterLastActivityEnd;
    }
    if (this.filterDeptStatus && this.filterDeptStatus !== 'ALL') {
      activeFilters.deptStatus = this.filterDeptStatus;
    }
    if (this.filterCreatedBy) {
      activeFilters.createdBy = this.filterCreatedBy;
    }
    
    return Object.keys(activeFilters).length > 0 ? JSON.stringify(activeFilters) : '';
  }

  loadSubDepartments(): void {
    if (this.role !== 'HOD' && this.selectedDeptId === null) return;
    this.loadingSubDepts = true;
    this.subDeptError = false;
    this.cdr.markForCheck();
    
    const serializedFilters = this.getSerializedFilters();

    this.subscriptions.add(
      this.apiService.getSubDepartments(this.selectedDeptId, this.subDeptSearch, serializedFilters, this.subDeptPage, this.subDeptSize, this.subDeptSort)
        .pipe(finalize(() => {
          this.loadingSubDepts = false;
          this.cdr.markForCheck();
        }))
        .subscribe({
          next: (res) => {
            this.subDepartments = res.content || [];
            this.totalSubDepts = res.page?.totalElements !== undefined ? res.page.totalElements : (res.totalElements || 0);
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('Failed to load subdepartments', err);
            this.subDeptError = true;
            this.cdr.markForCheck();
          }
        })
    );
  }

  onSubDeptSearchChange(value: string): void {
    this.subDeptSearchSubject.next(value);
  }

  applyFilters(): void {
    this.subDeptPage = 0;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  resetFilters(): void {
    this.filterTaskStatus = '';
    this.filterUserCountMin = null;
    this.filterUserCountMax = null;
    this.filterSubjectCountMin = null;
    this.filterSubjectCountMax = null;
    this.filterCreatedDateStart = '';
    this.filterCreatedDateEnd = '';
    this.filterLastActivityStart = '';
    this.filterLastActivityEnd = '';
    this.filterDeptStatus = '';
    this.filterCreatedBy = '';
    this.subDeptPage = 0;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  onSubDeptSizeChange(newSize: number): void {
    this.subDeptSize = newSize;
    this.subDeptPage = 0;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  changeSubDeptPage(delta: number): void {
    this.subDeptPage += delta;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  get subDeptTotalPages(): number {
    return Math.max(1, Math.ceil(this.totalSubDepts / this.subDeptSize));
  }

  getSubDeptPageNumbers(): number[] {
    const total = this.subDeptTotalPages;
    const current = this.subDeptPage + 1;

    if (total <= 9) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [1, 2];
    const start = Math.max(3, current - 1);
    const end = Math.min(total - 2, current + 1);

    if (start > 3) {
      pages.push(-1);
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (end < total - 2) {
      pages.push(-1);
    }

    pages.push(total - 1, total);
    return pages;
  }

  sortSubDeptBy(field: string): void {
    if (this.subDeptSortField === field) {
      this.subDeptSortDir = this.subDeptSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.subDeptSortField = field;
      this.subDeptSortDir = 'asc';
    }
    this.subDeptSort = `${this.subDeptSortField},${this.subDeptSortDir}`;
    this.subDeptPage = 0;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  getSortIcon(field: string): string {
    if (this.subDeptSortField !== field) return 'bi-arrow-down-up text-muted opacity-50';
    return this.subDeptSortDir === 'asc' ? 'bi-sort-up text-primary' : 'bi-sort-down text-primary';
  }

  // =========================================================================
  // VIEW USERS OVERLAY
  // =========================================================================

  openUsers(subDept: SubDepartmentRowDTO): void {
    this.modalWrapperService.open(AllWorkUsersComponent, {
      title: 'Users in ' + subDept.name,
      subtitle: 'Manage, search, and monitor user workloads.',
      sizeClass: 'modal-xl',
      data: {
        subDept: subDept,
        dashboardData: this.dashboardData,
        onOpenUserTasks: (u: UserRowDTO) => this.openUserTasks(u),
        onOpenUserAnalytics: (u: UserRowDTO) => this.openUserAnalytics(u),
        onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
      }
    });
    this.updateQueryParams();
  }

  // =========================================================================
  // VIEW TASKS OVERLAY
  // =========================================================================

  openTasks(subDept: SubDepartmentRowDTO): void {
    this.modalWrapperService.open(AllWorkTasksComponent, {
      title: `Tasks in ${subDept.name}`,
      subtitle: 'Centralized task lifecycle oversight, priority tracking, and export.',
      sizeClass: 'modal-xl',
      data: {
        subDept: subDept,
        user: null,
        dashboardData: this.dashboardData,
        onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
      }
    });
    this.updateQueryParams();
  }

  openUserTasks(user: UserRowDTO): void {
    const currentModal = this.modalWrapperService.getCurrentModal();
    const subDept = currentModal?.config.data?.subDept || null;

    this.modalWrapperService.push(AllWorkTasksComponent, {
      title: `Tasks assigned to ${user.fullName}`,
      subtitle: 'Centralized task lifecycle oversight, priority tracking, and export.',
      sizeClass: 'modal-xl',
      data: {
        subDept: subDept,
        user: user,
        dashboardData: this.dashboardData,
        onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
      }
    });
    this.updateQueryParams();
  }

  openUserTasksDirectly(userId: number): void {
    this.modalWrapperService.open(AllWorkTasksComponent, {
      title: `Tasks`,
      subtitle: 'Centralized task lifecycle oversight, priority tracking, and export.',
      sizeClass: 'modal-xl',
      data: {
        subDept: null,
        user: { userId } as UserRowDTO,
        dashboardData: this.dashboardData,
        onNavigateEntity: (type: string, id: any, event?: Event) => this.navigateToEntity(type, id, event)
      }
    });
    this.updateQueryParams();
  }

  // =========================================================================
  // ANALYTICS OVERLAY
  // =========================================================================

  openSubDeptAnalytics(subDept: SubDepartmentRowDTO): void {
    this.modalWrapperService.open(AllWorkAnalyticsComponent, {
      title: `Analytics Overview for ${subDept.name}`,
      subtitle: 'Granular work distribution, task states, and performance metrics.',
      sizeClass: 'modal-lg',
      data: {
        subDept: subDept,
        user: null
      }
    });
    this.updateQueryParams();
  }

  openUserAnalytics(user: UserRowDTO): void {
    const currentModal = this.modalWrapperService.getCurrentModal();
    const subDept = currentModal?.config.data?.subDept || null;

    this.modalWrapperService.push(AllWorkAnalyticsComponent, {
      title: `Analytics Overview for ${user.fullName}`,
      subtitle: 'Granular work distribution, task states, and performance metrics.',
      sizeClass: 'modal-lg',
      data: {
        subDept: subDept,
        user: user
      }
    });
    this.updateQueryParams();
  }

  closeAllModals(): void {
    this.modalWrapperService.clear();
    // ignore quick clicks after closing modal to avoid accidental re-open
    this.ignoreClicksUntil = Date.now() + 300;
    this.updateQueryParams();
  }

  goBackModal(): void {
    this.location.back();
  }

  // =========================================================================
  // EXPORT TRIGGERS
  // =========================================================================

  toggleExportDropdown(): void {
    this.exportDropdownOpen = !this.exportDropdownOpen;
  }

  closeExportDropdown(): void {
    this.exportDropdownOpen = false;
  }

  exportSubDepartments(format: string): void {
    if (this.role !== 'HOD' && this.selectedDeptId === null) return;
    const serializedFilters = this.getSerializedFilters();
    this.apiService.exportSubDepartmentsBlob(this.selectedDeptId, this.subDeptSearch, serializedFilters, format)
      .subscribe({
        next: (res: any) => {
          const blob = res.body as Blob;
          const contentDisposition = res.headers?.get?.('content-disposition') || '';
          let filename = 'export.' + (format === 'CSV' ? 'csv' : 'xlsx');
          const match = /filename\*=UTF-8''([^;\n]+)/i.exec(contentDisposition) || /filename="?([^";\n]+)"?/i.exec(contentDisposition);
          if (match && match[1]) filename = decodeURIComponent(match[1]);

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => {
          console.error('Export failed', err);
        }
      });
    this.exportDropdownOpen = false;
  }
}
