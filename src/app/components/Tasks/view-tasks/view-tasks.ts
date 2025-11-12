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
  tasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];

  loading = false;
  errorMessage: string | null = null;
  isForbidden = false;

  searchTerm = '';
  statusFilter = '';

  currentPage = 1;
  pageSize = 8;
  totalPages = 1;

  // User Info
  currentUserId: number | null = null;
  currentUserRole: string | null = null;
  currentUserDeptIds: number[] = [];

  private subscriptions = new Subscription();

  constructor(
    private apiService: TaskApiService,
    private userService: UserApiService,
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private authApiService: AuthApiService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUserAndTasks();
  }

  /** Load current user → then decide which tasks to load */
  private loadCurrentUserAndTasks(): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const userId = this.jwtService.getUserIdFromToken(token);
    if (!userId) {
      this.errorMessage = 'Invalid session';
      return;
    }

    this.currentUserId = userId;
    this.loading = true;

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
                this.loadTasksForApproval(); // Fixed typo
              } else if (status) {
                this.loadTasksByStatus(this.statusFilter);
              } else {
                this.loadTasksByRole();
              }
            })
          );
        },
        error: () => {
          this.errorMessage = 'Failed to load user profile';
          this.loading = false;
        }
      })
    );
  }

  /** Load tasks requiring approval (requiresApproval=true && approved=false) */
  loadTasksForApproval(): void {
    this.loading = true;
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
          tasks = this.filterTasksByRole(tasks); // Apply HOD/ADMIN filter
          this.handleTaskResponse(tasks);
        })
    );
  }

  /** Load tasks where current user is the creator AND assignee (self-assigned) */
  loadTasksForSelf(): void {
    if (!this.currentUserId) return;

    this.loading = true;
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
          this.handleTaskResponse(tasks); // Filtering done in applyFilters()
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
      this.loading = false;
    }
  }

  /** ADMIN: All tasks */
  private loadAllTasks(): void {
    this.loading = true;
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
      return;
    }

    this.loading = true;
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
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.tasks)) return res.tasks;
    return [];
  }

  /** Handle success response */
  private handleTaskResponse(tasks: TaskDto[]): void {
    this.errorMessage = null;
    this.isForbidden = false;
    this.tasks = tasks || [];
    this.applyFilters();
  }

  /** Centralized error */
  private handleError(err: any, fallback: string): void {
    console.error(err);
    this.errorMessage = err?.message || err?.error?.message || fallback;
  }

  // ──────────────────────────────────────────────────────────────
  //  FILTER LOGIC – Updated for SELF, SELFASSIGNED, APPROVAL
  // ──────────────────────────────────────────────────────────────

  private isSelfTask(task: TaskDto): boolean {
    if (!this.currentUserId) return false;

    const assigned = task.assignedToIds || [];
    const isAssignedToMe = assigned.includes(this.currentUserId);
    const createdByMe = task.createdById === this.currentUserId;

    // Must be assigned to me
    if (!isAssignedToMe) return false;

    // If created by me → only show if no one else is assigned
    if (createdByMe) {
      return assigned.length === 1;
    }

    // If created by someone else → show if assigned to me
    return true;
  }

  private isSelfAssignedTask(task: TaskDto): boolean {
    if (!this.currentUserId) return false;
    const assigned = task.assignedToIds || [];
    const isAssignedToMe = assigned.includes(this.currentUserId);
    const createdByMe = task.createdById === this.currentUserId;
    const assigneeCountIsOne = assigned.length === 1;

    return createdByMe && isAssignedToMe && assigneeCountIsOne;
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase();

    this.filteredTasks = this.tasks.filter(task => {
      // ── Search Term ──
      const matchesSearch =
        !term ||
        task.title?.toLowerCase().includes(term) ||
        task.assignedToNames?.some(n => n?.toLowerCase().includes(term)) ||
        task.departmentNames?.some(n => n?.toLowerCase().includes(term));

      // ── Status Filter Logic ──
      let matchesStatus = true;

      if (this.statusFilter === 'SELF') {
        matchesStatus = this.isSelfTask(task);
      } else if (this.statusFilter === 'SELFASSIGNED') {
        matchesStatus = this.isSelfAssignedTask(task);
      } else if (this.statusFilter === 'APPROVAL') {
        matchesStatus = task.requiresApproval === true && task.approved === false;
      } else if (this.statusFilter) {
        matchesStatus = task.status?.toUpperCase() === this.statusFilter;
      }

      return matchesSearch && matchesStatus;
    });

    this.totalPages = Math.max(Math.ceil(this.filteredTasks.length / this.pageSize), 1);
    this.currentPage = 1;
  }

  // ──────────────────────────────────────────────────────────────

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
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
    if (taskId) this.router.navigate(['/task', taskId]);
  }

  deleteTask(event: Event, taskId?: number): void {
    event.stopPropagation();
    if (!taskId || !confirm('Are you sure you want to delete this task?')) return;

    this.loading = true;
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
          } else {
            this.handleError(res, res?.message || 'Delete failed');
          }
        })
    );
  }

  getStatusClass(status?: string): string {
    switch (status?.toUpperCase()) {
      case 'PENDING':
      case 'UPCOMING': return 'bg-warning text-dark';
      case 'DELAYED': return 'bg-danger blink';
      case 'REQUEST_FOR_CLOSURE':
      case 'REQUEST_FOR_EXTENSION': return 'bg-info';
      case 'CLOSED': return 'bg-success';
      default: return 'bg-secondary';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}