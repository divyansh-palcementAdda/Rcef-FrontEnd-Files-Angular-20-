import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { TaskDto } from '../../../Model/TaskDto';
import { JwtService } from '../../../Services/jwt-service';
import { Subscription, of } from 'rxjs';
import { finalize, catchError } from 'rxjs/operators';
import { userDto } from '../../../Model/userDto';
import { AuthApiService } from '../../../Services/auth-api-service';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Component({
  selector: 'app-view-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-tasks.html',
  styleUrls: ['./view-tasks.css']
})
export class ViewTasksComponent implements OnInit, OnDestroy {
  // Task Data
  tasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];
  readonly Math = Math;

  // UI States
  loading = false;
  loadingMessage = 'Loading tasks...';
  errorMessage: string | null = null;
  isForbidden = false;
  isEmpty = false;

  // Filters
  searchTerm = '';
  statusFilter = '';

  // Pagination
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;
  totalTasks = 0;

  // User Info
  currentUserId: number | null = null;
  currentUserRole: string | null = null;
  currentUserDeptIds: number[] = [];

  // Stats
  taskStats = {
    total: 0,
    pending: 0,
    delayed: 0,
    completed: 0,
    In_PROGRESS: 0
  };

  private subscriptions = new Subscription();

  constructor(
    private apiService: TaskApiService,
    private userService: UserApiService,
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private authApiService: AuthApiService
  ) { }

  ngOnInit(): void {
    this.loadCurrentUserAndTasks();
  }

  /** Load current user → then decide which tasks to load */
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

    this.currentUserId = userId;
    this.loading = true;
    this.loadingMessage = 'Loading user profile...';

    this.subscriptions.add(
      this.userService.getUserById(userId).subscribe({
        next: (user: userDto) => {
          this.currentUserRole = user.role;
          this.currentUserDeptIds = user.departmentIds || [];

          // Subscribe to query params once user is loaded
          this.subscriptions.add(
            this.route.queryParams.subscribe(params => {
              const status = params['status'];
              this.statusFilter = status ? status.toUpperCase() : '';

              if (status?.toLowerCase() === 'self') {
                this.loadTasksForCurrentUser();
              } else if (status?.toLowerCase() === 'selfassigned') {
                this.loadTasksForSelf();
              } else if (status?.toLowerCase() === 'approval') {
                this.loadTasksForApproval();
              } else if (status?.toLowerCase() === 'parent_recurring') {
                console.log('PARENT_RECURRING filter selected');
                this.loadReccuringParentTasks();
              }
              else if (status?.toLowerCase() === 'recurred_instance') {
                console.log('RECURRED_INSTANCE filter selected');
                this.loadRecurredInstanceTasks();
              }
              else if (status?.toLowerCase() === 'my_department') {
                console.log('MY_DEPARTMENT filter selected');
                this.loadTasksByDepartment();
              }
              else if (status) {
                this.loadTasksByStatus(this.statusFilter);
              } else {
                this.loadTasksByRole();
              }
            })
          );
        },
        error: (err) => {
          console.error('Failed to load user profile:', err);
          this.errorMessage = 'Failed to load user profile. Please try again.';
          this.loading = false;
        }
      })
    );
  }
  loadTasksByDepartment(): void {
    if (this.currentUserDeptIds.length === 0) {
      this.tasks = [];
      this.applyFilters();
      this.loading = false;
      this.isEmpty = true;
      return;
    }
    this.loading = true;
    this.loadingMessage = 'Loading department tasks...';
    console.log('Loading tasks for departments:', this.currentUserDeptIds);
    this.subscriptions.add(
      this.apiService.getTasksByDepartment(this.currentUserDeptIds[0])
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, 'Failed to load department tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => this.handleTaskResponse(this.extractTasks(res)))
    );
  }
// Add these methods to your ViewTasksComponent class

loadReccuringParentTasks(): void {
  this.loading = true;
  this.loadingMessage = 'Loading recurring parent tasks...';
  this.errorMessage = null;
  this.isEmpty = false;
console.log('Loading recurring parent tasks...');
  this.subscriptions.add(
    this.apiService.getAllRecurringParentTasks()  // ← adjust method name to match your TaskApiService
      .pipe(
        finalize(() => this.loading = false),
        catchError(err => {
          this.handleError(err, 'Failed to load recurring parent tasks.');
          return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
        })
      )
      .subscribe(res => {
        const tasks = this.extractTasks(res);
        // Optional: extra client-side filtering if needed (rarely necessary here)
        this.handleTaskResponse(tasks);
      })
  );
}

loadRecurredInstanceTasks(): void {
  this.loading = true;
  this.loadingMessage = 'Loading all recurring instance tasks...';
  this.errorMessage = null;
  this.isEmpty = false;

  this.subscriptions.add(
    this.apiService.getAllRecurredInstanceTasks()  // ← adjust method name to match your service
      .pipe(
        finalize(() => this.loading = false),
        catchError(err => {
          this.handleError(err, 'Failed to load recurring instance tasks.');
          return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
        })
      )
      .subscribe(res => {
        const tasks = this.extractTasks(res);
        this.handleTaskResponse(tasks);
      })
  );
}

  /** Calculate task statistics */
  private calculateStats(tasks: TaskDto[]): void {
    this.taskStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'PENDING' || t.status === 'UPCOMING').length,
      delayed: tasks.filter(t => t.status === 'DELAYED').length,
      completed: tasks.filter(t => t.status === 'CLOSED').length,
      In_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length
    };
  }

  /** Load tasks requiring approval (requiresApproval=true && approved=false) */
  loadTasksForApproval(): void {
    this.loading = true;
    this.loadingMessage = 'Loading approval tasks...';
    this.subscriptions.add(
      this.apiService.getAllTasksWhichRequriesApproval()
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, 'Failed to load approval tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => {
          let tasks = this.extractTasks(res);
          tasks = this.filterTasksByRole(tasks);
          this.handleTaskResponse(tasks);
        })
    );
  }

  /** Load tasks where current user is the creator AND assignee (self-assigned) */
  loadTasksForSelf(): void {
    if (!this.currentUserId) return;

    this.loading = true;
    this.loadingMessage = 'Loading self-assigned tasks...';
    this.subscriptions.add(
      this.apiService.getTasksByUser(this.currentUserId)
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, 'Failed to load self-assigned tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => {
          const tasks = this.extractTasks(res);
          this.handleTaskResponse(tasks);
        })
    );
  }

  /** Role-based task loading */
  private loadTasksByRole(): void {
    if (this.currentUserRole === 'ADMIN') {
      this.loadAllTasks();
    } else if (this.currentUserRole === 'HOD') {
      this.loadTasksByHODDepartments();
    } else if (this.currentUserRole === 'TEACHER') {
      this.loadTasksForCurrentUser();
    } else {
      this.errorMessage = 'Unauthorized role';
      this.isForbidden = true;
      this.loading = false;
    }
  }

  /** ADMIN: All tasks */
  private loadAllTasks(): void {
    this.loading = true;
    this.loadingMessage = 'Loading all tasks...';
    this.subscriptions.add(
      this.apiService.getAllTasks()
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, 'Failed to load tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => this.handleTaskResponse(this.extractTasks(res)))
    );
  }

  /** HOD: Tasks in their departments */
  private loadTasksByHODDepartments(): void {
    if (!this.currentUserDeptIds.length) {
      this.tasks = [];
      this.applyFilters();
      this.loading = false;
      this.isEmpty = true;
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Loading department tasks...';
    console.log('Loading tasks for departments:', this.currentUserDeptIds);
    this.subscriptions.add(
      this.apiService.getTasksByDepartment(this.currentUserDeptIds[0])
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, 'Failed to load department tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => this.handleTaskResponse(this.extractTasks(res)))
    );
  }

  /** TEACHER: Only tasks assigned to them */
  private loadTasksForCurrentUser(): void {
    if (!this.currentUserId) return;

    this.loading = true;
    this.loadingMessage = 'Loading your tasks...';
    this.subscriptions.add(
      this.apiService.getTasksByUser(this.currentUserId)
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, 'Failed to load your tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => this.handleTaskResponse(this.extractTasks(res)))
    );
  }

  /** Load by status (with role filter applied after) */
  private loadTasksByStatus(status: string): void {
    this.loading = true;
    this.loadingMessage = `Loading ${status.toLowerCase()} tasks...`;
    this.subscriptions.add(
      this.apiService.getTasksByStatus(status)
        .pipe(
          finalize(() => this.loading = false),
          catchError(err => {
            this.handleError(err, `Failed to load ${status} tasks.`);
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => {
          let tasks = this.extractTasks(res);
          tasks = this.filterTasksByRole(tasks);
          this.handleTaskResponse(tasks);
        })
    );
  }

  /** Filter tasks client-side by role (used after status fetch) */
  private filterTasksByRole(tasks: TaskDto[]): TaskDto[] {
    if (this.currentUserRole === 'ADMIN') return tasks;
    if (this.currentUserRole === 'HOD') {
      return tasks.filter(t =>
        t.departmentIds?.some(id => this.currentUserDeptIds.includes(id))
      );
    }
    if (this.currentUserRole === 'TEACHER' && this.currentUserId) {
      return tasks.filter(t =>
        t.assignedToIds?.includes(this.currentUserId!)
      );
    }
    return [];
  }

  /** Safely extract tasks */
  private extractTasks(res: any): TaskDto[] {
    if (!res) return [];
    if (res.success === false) {
      this.handleError(res, res.message || 'Error fetching tasks');
      return [];
    }
    // console.log('API response for tasks:', res);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.tasks)) return res.tasks;
    return [];
  }

  /** Handle success response */
  private handleTaskResponse(tasks: TaskDto[]): void {
    this.errorMessage = null;
    this.isForbidden = false;
    console.log('Loaded tasks:', tasks);
    this.isEmpty = tasks.length === 0;
    this.tasks = tasks || [];
    console.log('Total tasks loaded:', this.tasks.length);
    this.totalTasks = tasks.length;
    this.calculateStats(tasks);
    this.applyFilters();
  }

  /** Centralized error */
  private handleError(err: any, fallback: string): void {
    console.error('Task loading error:', err);
    this.errorMessage = err?.message || err?.error?.message || fallback;
    this.isForbidden = err?.status === 403;
    this.isEmpty = true;
  }

  // ──────────────────────────────────────────────────────────────
  //  FILTER LOGIC – Updated for SELF, SELFASSIGNED, APPROVAL
  // ──────────────────────────────────────────────────────────────

  private isSelfTask(task: TaskDto): boolean {
    if (!this.currentUserId) return false;

    const assigned = task.assignedToIds || [];
    const isAssignedToMe = assigned.includes(this.currentUserId);
    // const createdByMe = task.createdById === this.currentUserId;

    // Must be assigned to me
    if (!isAssignedToMe) return false;
    // If created by someone else → show if assigned to me
    return true;
  }

  private isSelfAssignedTask(task: TaskDto): boolean {
    if (!this.currentUserId) return false;
    const assigned = task.assignedToIds || [];
    const isAssignedToMe = assigned.includes(this.currentUserId);
    const createdByMe = task.createdById === this.currentUserId;
    // const assigneeCountIsOne = assigned.length === 1;

    return createdByMe && isAssignedToMe;
  }

applyFilters(): void {
  const term = this.searchTerm.trim().toLowerCase();

  this.filteredTasks = this.tasks.filter(task => {
    // 1. Search term matching
    const matchesSearch = !term || 
      task.title?.toLowerCase().includes(term) ||
      task.assignedToNames?.some(name => name?.toLowerCase().includes(term)) ||
      task.departmentNames?.some(name => name?.toLowerCase().includes(term)) ||
      // Optional: also search in description if you want broader search
      task.description?.toLowerCase().includes(term) ||
      false;

    // 2. Status / View Type filter
    let matchesFilter = true;

    switch (this.statusFilter?.toUpperCase()) {
      case 'SELF':
        matchesFilter = this.isSelfTask(task);
        break;

      case 'SELFASSIGNED':
        matchesFilter = this.isSelfAssignedTask(task);
        break;

      case 'APPROVAL':
        matchesFilter = !!task.requiresApproval && !task.approved;
        break;

      case 'MY_DEPARTMENT':
        matchesFilter = task.departmentIds?.some(id => 
          this.currentUserDeptIds.includes(id)
        ) ?? false;
        break;

      // ── New recurring filters ──
      case 'PARENT_RECURRING':
        matchesFilter = !!task.isRecurring && task.parentTaskId == null;
        break;

      case 'RECURRED_INSTANCE':
        matchesFilter = !task.isRecurring && task.parentTaskId != null;
        break;

      // Regular status filter (PENDING, IN_PROGRESS, CLOSED, etc.)
      default:
        if (this.statusFilter) {
          matchesFilter = task.status?.toUpperCase() === this.statusFilter;
        }
        // If no statusFilter → show all (matchesFilter remains true)
        break;
    }

    return matchesSearch && matchesFilter;
  });

  // Update pagination
  this.totalPages = Math.max(1, Math.ceil(this.filteredTasks.length / this.pageSize));
  this.currentPage = Math.min(this.currentPage, this.totalPages || 1); // prevent invalid page
}

  // ──────────────────────────────────────────────────────────────

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
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
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTasks.slice(start, start + this.pageSize);
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

  deleteTask(event: Event, taskId?: number): void {
    event.stopPropagation();
    if (!taskId || !confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;

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
            this.tasks = this.tasks.filter(t => t.taskId !== taskId);
            this.applyFilters();
            this.calculateStats(this.tasks);
          } else {
            this.handleError(res, res?.message || 'Delete failed');
          }
        })
    );
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

  canDeleteTask(): boolean {
    return this.currentUserRole === 'ADMIN';
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}