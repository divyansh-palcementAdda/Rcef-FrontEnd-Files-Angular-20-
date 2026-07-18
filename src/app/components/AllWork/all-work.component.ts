import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
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

@Component({
  selector: 'app-all-work',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalWrapperComponent],
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

  // Modal Overlays views stack
  modalStack: string[] = [];
  selectedSubDept: SubDepartmentRowDTO | null = null;
  selectedUser: UserRowDTO | null = null;

  // Users Modal Table
  users: UserRowDTO[] = [];
  totalUsers = 0;
  userSearch = '';
  userPage = 0;
  userSize = 10;
  userSort = 'fullName,asc';
  loadingUsers = false;

  // Tasks Modal Table
  tasks: any[] = [];
  totalTasks = 0;
  taskSearch = '';
  taskStatus = 'ALL';
  taskPage = 0;
  taskSize = 10;
  taskSort = 'createdAt,desc';
  loadingTasks = false;

  // Analytics Modal
  analytics: WorkAnalyticsResponse | null = null;
  loadingAnalytics = false;

  // Status Tabs for Tasks
  statusTabs = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Delayed', value: 'DELAYED' },
    { label: 'Upcoming', value: 'UPCOMING' },
    { label: 'Extended', value: 'EXTENDED' },
    { label: 'Closure Requests', value: 'CLOSURE_REQUESTS' },
    { label: 'Extension Requests', value: 'EXTENSION_REQUESTS' },
    { label: 'Recurring Parent', value: 'RECURRING_PARENT' }
  ];

  isInitialLoad = true;
  private subscriptions = new Subscription();

  constructor(
    private apiService: AllWorkApiService,
    private jwtService: JwtService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const token = this.jwtService.getAccessToken();
    this.currentUserId = token ? this.jwtService.getUserIdFromToken(token) : null;
    
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        if (this.isInitialLoad) {
          this.isInitialLoad = false;
          
          if (params['dept']) this.selectedDeptId = parseInt(params['dept'], 10);
          if (params['subDeptSearch']) this.subDeptSearch = params['subDeptSearch'];
          if (params['subDeptPage']) this.subDeptPage = parseInt(params['subDeptPage'], 10);
          if (params['subDeptSize']) this.subDeptSize = parseInt(params['subDeptSize'], 10);
          if (params['subDeptSort']) this.subDeptSort = params['subDeptSort'];
          if (params['userSearch']) this.userSearch = params['userSearch'];
          if (params['userPage']) this.userPage = parseInt(params['userPage'], 10);
          if (params['userSize']) this.userSize = parseInt(params['userSize'], 10);
          if (params['userSort']) this.userSort = params['userSort'];
          if (params['taskSearch']) this.taskSearch = params['taskSearch'];
          if (params['taskStatus']) this.taskStatus = params['taskStatus'];
          if (params['taskPage']) this.taskPage = parseInt(params['taskPage'], 10);
          if (params['taskSize']) this.taskSize = parseInt(params['taskSize'], 10);
          if (params['taskSort']) this.taskSort = params['taskSort'];

          this.loadDashboard(params);
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
    this.subscriptions.add(
      this.apiService.getDashboardData()
        .pipe(finalize(() => this.loadingDashboard = false))
        .subscribe({
          next: (res) => {
            this.dashboardData = res;
            this.role = res.role;
            this.departments = res.departments || [];
            
            if (this.role === 'SUPER_ADMIN' || this.role === 'ADMIN' || this.role === 'SUB_ADMIN') {
              if (params['dept']) {
                this.selectedDeptId = parseInt(params['dept'], 10);
              } else if (res.defaultId) {
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

            // Restore modal state if query parameters specify it
            if (params['modal']) {
              const subDeptId = params['subDeptId'];
              const userId = params['userId'] ? parseInt(params['userId'], 10) : null;
              
              if (params['modal'] === 'users' && subDeptId) {
                this.selectedSubDept = { id: subDeptId } as SubDepartmentRowDTO;
                this.modalStack = ['users'];
                this.loadUsers();
              } else if (params['modal'] === 'tasks') {
                if (userId) {
                  this.selectedUser = { userId: userId } as UserRowDTO;
                  if (subDeptId) {
                    this.selectedSubDept = { id: subDeptId } as SubDepartmentRowDTO;
                    this.modalStack = ['users', 'tasks'];
                    this.loadUsers();
                  } else {
                    this.selectedSubDept = null;
                    this.modalStack = ['tasks'];
                  }
                } else if (subDeptId) {
                  this.selectedSubDept = { id: subDeptId } as SubDepartmentRowDTO;
                  this.selectedUser = null;
                  this.modalStack = ['tasks'];
                }
                this.loadTasks();
              } else if (params['modal'] === 'analytics') {
                if (userId) {
                  this.selectedUser = { userId: userId } as UserRowDTO;
                  if (subDeptId) {
                    this.selectedSubDept = { id: subDeptId } as SubDepartmentRowDTO;
                    this.modalStack = ['users', 'analytics'];
                    this.loadUsers();
                  } else {
                    this.selectedSubDept = null;
                    this.modalStack = ['analytics'];
                  }
                } else if (subDeptId) {
                  this.selectedSubDept = { id: subDeptId } as SubDepartmentRowDTO;
                  this.selectedUser = null;
                  this.modalStack = ['analytics'];
                }
                this.loadAnalytics();
              }
            }
          },
          error: (err) => console.error('Failed to load work dashboard data', err)
        })
    );
  }

  updateQueryParams(): void {
    const queryParams: any = {
      dept: this.selectedDeptId,
      subDeptSearch: this.subDeptSearch || null,
      subDeptPage: this.subDeptPage || null,
      subDeptSize: this.subDeptSize || null,
      subDeptSort: this.subDeptSort || null,
      userSearch: this.userSearch || null,
      userPage: this.userPage || null,
      userSize: this.userSize || null,
      userSort: this.userSort || null,
      taskSearch: this.taskSearch || null,
      taskStatus: this.taskStatus || null,
      taskPage: this.taskPage || null,
      taskSize: this.taskSize || null,
      taskSort: this.taskSort || null,
      modal: this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1] : null,
      subDeptId: this.selectedSubDept ? this.selectedSubDept.id : null,
      userId: this.selectedUser ? this.selectedUser.userId : null
    };

    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === null || queryParams[key] === undefined) {
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

  navigateToEntity(type: 'task' | 'user' | 'sub-department' | 'department', id: any, event?: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select') || target.closest('.btn-group') || target.closest('ul')) {
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
    this.selectedDeptId = deptId;
    this.subDeptPage = 0;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  loadSubDepartments(): void {
    if (this.role !== 'HOD' && this.selectedDeptId === null) return;
    this.loadingSubDepts = true;
    
    // Passing selectedDeptId or 0 if HOD (backend visibility filters will handle HOD subdepartments automatically)
    const deptId = this.selectedDeptId || 0;

    this.subscriptions.add(
      this.apiService.getSubDepartments(deptId, this.subDeptSearch, this.subDeptPage, this.subDeptSize, this.subDeptSort)
        .pipe(finalize(() => this.loadingSubDepts = false))
        .subscribe({
          next: (res) => {
            this.subDepartments = res.content || [];
            this.totalSubDepts = res.totalElements || 0;
          },
          error: (err) => console.error('Failed to load subdepartments', err)
        })
    );
  }

  onSubDeptSearchChange(): void {
    this.subDeptPage = 0;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  changeSubDeptPage(delta: number): void {
    this.subDeptPage += delta;
    this.updateQueryParams();
    this.loadSubDepartments();
  }

  // =========================================================================
  // VIEW USERS OVERLAY
  // =========================================================================

  openUsers(subDept: SubDepartmentRowDTO): void {
    this.selectedSubDept = subDept;
    this.userPage = 0;
    this.userSearch = '';
    this.modalStack = ['users'];
    this.updateQueryParams();
    this.loadUsers();
  }

  loadUsers(): void {
    if (!this.selectedSubDept) return;
    this.loadingUsers = true;
    this.subscriptions.add(
      this.apiService.getSubDepartmentUsers(this.selectedSubDept.id, this.userSearch, this.userPage, this.userSize, this.userSort)
        .pipe(finalize(() => this.loadingUsers = false))
        .subscribe({
          next: (res) => {
            this.users = res.content || [];
            this.totalUsers = res.totalElements || 0;
          },
          error: (err) => console.error('Failed to load subdepartment users', err)
        })
    );
  }

  onUserSearchChange(): void {
    this.userPage = 0;
    this.updateQueryParams();
    this.loadUsers();
  }

  changeUserPage(delta: number): void {
    this.userPage += delta;
    this.updateQueryParams();
    this.loadUsers();
  }

  closeUsersModal(): void {
    this.closeAllModals();
  }

  // =========================================================================
  // VIEW TASKS OVERLAY
  // =========================================================================

  openTasks(subDept: SubDepartmentRowDTO): void {
    this.selectedSubDept = subDept;
    this.selectedUser = null;
    this.taskPage = 0;
    this.taskSearch = '';
    this.taskStatus = 'ALL';
    this.modalStack = ['tasks'];
    this.updateQueryParams();
    this.loadTasks();
  }

  openUserTasks(user: UserRowDTO): void {
    this.selectedUser = user;
    if (!this.modalStack.includes('users')) {
      this.selectedSubDept = null;
    }
    this.taskPage = 0;
    this.taskSearch = '';
    this.taskStatus = 'ALL';
    if (this.modalStack.includes('users')) {
      this.modalStack.push('tasks');
    } else {
      this.modalStack = ['tasks'];
    }
    this.updateQueryParams();
    this.loadTasks();
  }

  openUserTasksDirectly(userId: number): void {
    this.selectedUser = { userId } as UserRowDTO;
    this.selectedSubDept = null;
    this.taskPage = 0;
    this.taskSearch = '';
    this.taskStatus = 'ALL';
    this.modalStack = ['tasks'];
    this.updateQueryParams();
    this.loadTasks();
  }

  loadTasks(): void {
    this.loadingTasks = true;
    let obs$;
    
    if (this.selectedUser) {
      obs$ = this.apiService.getUserTasks(this.selectedUser.userId, this.taskSearch, this.taskStatus, this.taskPage, this.taskSize, this.taskSort);
    } else if (this.selectedSubDept) {
      obs$ = this.apiService.getSubDepartmentTasks(this.selectedSubDept.id, this.taskSearch, this.taskStatus, this.taskPage, this.taskSize, this.taskSort);
    } else {
      this.loadingTasks = false;
      return;
    }

    this.subscriptions.add(
      obs$.pipe(finalize(() => this.loadingTasks = false))
        .subscribe({
          next: (res) => {
            this.tasks = res.content || [];
            this.totalTasks = res.totalElements || 0;
          },
          error: (err) => console.error('Failed to load tasks', err)
        })
    );
  }

  selectStatusTab(status: string): void {
    this.taskStatus = status;
    this.taskPage = 0;
    this.updateQueryParams();
    this.loadTasks();
  }

  onTaskSearchChange(): void {
    this.taskPage = 0;
    this.updateQueryParams();
    this.loadTasks();
  }

  changeTaskPage(delta: number): void {
    this.taskPage += delta;
    this.updateQueryParams();
    this.loadTasks();
  }

  closeTasksModal(): void {
    this.goBackModal();
  }

  // =========================================================================
  // ANALYTICS OVERLAY
  // =========================================================================

  openSubDeptAnalytics(subDept: SubDepartmentRowDTO): void {
    this.selectedSubDept = subDept;
    this.selectedUser = null;
    this.modalStack = ['analytics'];
    this.updateQueryParams();
    this.loadAnalytics();
  }

  openUserAnalytics(user: UserRowDTO): void {
    this.selectedUser = user;
    if (!this.modalStack.includes('users')) {
      this.selectedSubDept = null;
    }
    if (this.modalStack.includes('users')) {
      this.modalStack.push('analytics');
    } else {
      this.modalStack = ['analytics'];
    }
    this.updateQueryParams();
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.loadingAnalytics = true;
    let obs$;
    
    if (this.selectedUser) {
      obs$ = this.apiService.getUserAnalytics(this.selectedUser.userId);
    } else if (this.selectedSubDept) {
      obs$ = this.apiService.getSubDepartmentAnalytics(this.selectedSubDept.id);
    } else {
      this.loadingAnalytics = false;
      return;
    }

    this.subscriptions.add(
      obs$.pipe(finalize(() => this.loadingAnalytics = false))
        .subscribe({
          next: (res) => {
            this.analytics = res;
          },
          error: (err) => console.error('Failed to load analytics data', err)
        })
    );
  }

  closeAnalyticsModal(): void {
    this.goBackModal();
  }

  closeAllModals(): void {
    this.modalStack = [];
    this.selectedSubDept = null;
    this.selectedUser = null;
    this.tasks = [];
    this.users = [];
    this.analytics = null;
    this.updateQueryParams();
  }

  goBackModal(): void {
    if (this.modalStack.length > 1) {
      this.modalStack.pop();
      const top = this.modalStack[this.modalStack.length - 1];
      if (top === 'users') {
        this.selectedUser = null;
        this.tasks = [];
        this.analytics = null;
      }
      this.updateQueryParams();
    } else {
      this.closeAllModals();
    }
  }

  getCurrentModalTitle(): string {
    const top = this.modalStack[this.modalStack.length - 1];
    if (top === 'users') {
      return 'Users in ' + (this.selectedSubDept?.name || '');
    }
    if (top === 'tasks') {
      return this.tasksModalTitle;
    }
    if (top === 'analytics') {
      return this.analyticsModalTitle;
    }
    return '';
  }

  getCurrentModalSubtitle(): string {
    const top = this.modalStack[this.modalStack.length - 1];
    if (top === 'users') {
      return 'Manage, search, and monitor user workloads.';
    }
    if (top === 'tasks') {
      return 'Centralized task lifecycle oversight, priority tracking, and export.';
    }
    if (top === 'analytics') {
      return 'Granular work distribution, task states, and performance metrics.';
    }
    return '';
  }

  getCurrentModalSizeClass(): string {
    const top = this.modalStack[this.modalStack.length - 1];
    if (top === 'users' || top === 'tasks') {
      return 'modal-xl';
    }
    if (top === 'analytics') {
      return 'modal-lg';
    }
    return 'modal-md';
  }

  get tasksModalTitle(): string {
    if (this.selectedSubDept) {
      return `Tasks in ${this.selectedSubDept.name}`;
    }
    if (this.selectedUser) {
      return `Tasks assigned to ${this.selectedUser.fullName}`;
    }
    return 'Tasks';
  }

  get analyticsModalTitle(): string {
    if (this.selectedSubDept) {
      return `Analytics Overview for ${this.selectedSubDept.name}`;
    }
    if (this.selectedUser) {
      return `Analytics Overview for ${this.selectedUser.fullName}`;
    }
    return 'Analytics Overview';
  }

  // =========================================================================
  // EXPORT TRIGGERS
  // =========================================================================

  exportSubDepartments(format: string): void {
    if (this.selectedDeptId === null) return;
    const url = this.apiService.getExportSubDepartmentsUrl(this.selectedDeptId, this.subDeptSearch, format);
    window.open(url, '_blank');
  }

  exportUsers(format: string): void {
    if (!this.selectedSubDept) return;
    const url = this.apiService.getExportUsersUrl(this.selectedSubDept.id, this.userSearch, format);
    window.open(url, '_blank');
  }

  exportTasks(format: string): void {
    const subDeptId = this.selectedSubDept ? this.selectedSubDept.id : null;
    const userId = this.selectedUser ? this.selectedUser.userId : null;
    const url = this.apiService.getExportTasksUrl(subDeptId, userId, this.taskSearch, this.taskStatus, format);
    window.open(url, '_blank');
  }
}
