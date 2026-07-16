import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { TaskDto } from '../../../Model/TaskDto';
import { JwtService } from '../../../Services/jwt-service';
import { Subscription, of, Subject } from 'rxjs';
import { finalize, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { userDto } from '../../../Model/userDto';
import { AuthApiService } from '../../../Services/auth-api-service';
import { ModalService } from '../../../Services/modal-service';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';

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
  private modalService = inject(ModalService);
  private confirmDialog = inject(ConfirmDialogService);

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

  // Filters
  searchTerm = '';
  statusFilter = '';
  departmentFilter = '';
  dateFilter = '';
  selectedCard = 'total';
  categoryFilter = '';
  templateFilter = '';

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

  // Stats
  taskStats = {
    total: 0,
    active: 0,
    pending: 0,
    completed: 0,
    overdue: 0,
    extensionRequests: 0,
    closureRequests: 0,
    upcoming: 0,
    // Keep for backward compatibility
    delayed: 0,
    In_PROGRESS: 0
  };

  private subscriptions = new Subscription();
  private searchSubject = new Subject<string>();

  constructor(
    private apiService: TaskApiService,
    private userService: UserApiService,
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private authApiService: AuthApiService
  ) { }

  ngOnInit(): void {
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
        },
        error: (err) => {
          console.error('Failed to load user profile:', err);
          this.errorMessage = 'Failed to load user profile. Please try again.';
          this.loading = false;
        }
      })
    );
  }

  loadTasksFromServer(): void {
    this.loading = true;
    this.loadingMessage = 'Loading tasks...';

    const params: any = {
      page: this.currentPage - 1,
      size: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
      search: this.searchTerm
    };

    if (this.departmentFilter) {
      params.departmentName = this.departmentFilter;
    }

    if (this.categoryFilter) {
      params.category = this.categoryFilter;
    }

    if (this.templateFilter) {
      params.templateTitle = this.templateFilter;
    }

    // Map status filter from the toolbar select dropdown
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

    // Map selected KPI card filter (which overrides the status filter)
    if (this.selectedCard === 'active') {
      params.status = 'IN_PROGRESS';
    } else if (this.selectedCard === 'pending') {
      params.status = 'PENDING';
    } else if (this.selectedCard === 'completed') {
      params.status = 'CLOSED';
    } else if (this.selectedCard === 'overdue') {
      params.overdue = true;
    } else if (this.selectedCard === 'extensionRequests') {
      params.hasExtensionRequest = true;
    } else if (this.selectedCard === 'closureRequests') {
      params.hasClosureRequest = true;
    } else if (this.selectedCard === 'upcoming') {
      params.upcoming = true;
    }

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

            if (data.stats) {
              this.taskStats = data.stats;
            }
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

  selectCard(cardName: string): void {
    if (cardName === 'total') {
      this.selectedCard = 'total';
      this.searchTerm = '';
      this.statusFilter = '';
      this.departmentFilter = '';
    } else {
      this.selectedCard = cardName;
    }
    this.currentPage = 1;
    this.loadTasksFromServer();
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

  /** Calculate task statistics */
  private calculateStats(tasks: TaskDto[]): void {
    this.taskStats = {
      total: tasks.length,
      active: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      pending: tasks.filter(t => t.status === 'PENDING' || t.status === 'UPCOMING').length,
      completed: tasks.filter(t => t.status === 'CLOSED').length,
      overdue: tasks.filter(t => t.status === 'DELAYED').length,
      extensionRequests: tasks.filter(t => t.status === 'REQUEST_FOR_EXTENSION' || t.status === 'EXTENDED').length,
      closureRequests: tasks.filter(t => t.status === 'REQUEST_FOR_CLOSURE').length,
      upcoming: tasks.filter(t => t.status === 'UPCOMING').length,
      delayed: tasks.filter(t => t.status === 'DELAYED').length,
      In_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length
    };
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadTasksFromServer();
  }

  /** Called on every search keystroke — debounced, won't flash the skeleton */
  onSearchInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.departmentFilter = '';
    this.categoryFilter = '';
    this.templateFilter = '';
    this.selectedCard = 'total';
    this.currentPage = 1;
    this.loadTasksFromServer();
  }

  removeCategoryFilter(): void {
    this.categoryFilter = '';
    this.currentPage = 1;
    this.loadTasksFromServer();
  }

  removeTemplateFilter(): void {
    this.templateFilter = '';
    this.currentPage = 1;
    this.loadTasksFromServer();
  }

  removeStatusFilter(): void {
    this.statusFilter = '';
    this.selectedCard = 'total';
    this.currentPage = 1;
    this.loadTasksFromServer();
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
              this.tasks = this.tasks.filter(t => t.taskId !== taskId);
              this.applyFilters();
              this.calculateStats(this.tasks);
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
    if (this.currentUserRole === "TEACHER") return false;
    if (this.currentUserRole === "HOD") {
      return task?.createdById === this.currentUserId;
    }
    return true;
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
    this.router.navigate(['/tasks/import']);
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