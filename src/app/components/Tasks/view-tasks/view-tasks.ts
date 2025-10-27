import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { TaskDto } from '../../../Model/TaskDto';
import { JwtService } from '../../../Services/jwt-service';
import { Subscription, of } from 'rxjs';
import { finalize, catchError } from 'rxjs/operators';

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
  loggedInUserID: number | null = null;

  searchTerm = '';
  statusFilter = '';

  currentPage = 1;
  pageSize = 8;
  totalPages = 1;

  private subscriptions = new Subscription();

  constructor(
    private apiService: TaskApiService,
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        const status = params['status'];
        this.statusFilter = status ? status.toUpperCase() : '';
        if (status?.toLowerCase() === 'self') {
          this.loadTasksByUser();
        } else if (status) {
          this.loadTasksByStatus(this.statusFilter);
        } else {
          this.loadAllTasks();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** 🔹 Load tasks for logged-in user */
  private loadTasksByUser(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.loggedInUserID = this.jwtService.getUserIdFromToken(token);
    if (!this.loggedInUserID) return;

    this.loading = true;
    this.subscriptions.add(
      this.apiService.getTasksByUser(this.loggedInUserID)
        .pipe(
          finalize(() => (this.loading = false)),
          catchError(err => {
            this.handleError(err, 'Failed to load your tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => this.handleTaskResponse(this.extractTasks(res)))
    );
  }

  /** 🔹 Load all tasks */
  private loadAllTasks(): void {
    this.loading = true;
    this.subscriptions.add(
      this.apiService.getAllTasks()
        .pipe(
          finalize(() => (this.loading = false)),
          catchError(err => {
            this.handleError(err, 'Failed to load tasks.');
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => this.handleTaskResponse(this.extractTasks(res)))
    );
  }

  /** 🔹 Load tasks by status */
  private loadTasksByStatus(status: string): void {
    this.loading = true;
    this.subscriptions.add(
      this.apiService.getTasksByStatus(status)
        .pipe(
          finalize(() => (this.loading = false)),
          catchError(err => {
            this.handleError(err, `Failed to load ${status} tasks.`);
            return of({ success: false, data: [] } as ApiResponse<TaskDto[]>);
          })
        )
        .subscribe(res => this.handleTaskResponse(this.extractTasks(res)))
    );
  }

  /** ✅ Safely extract tasks array from API response */
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

  /** ✅ Handle API success response */
  private handleTaskResponse(tasks: TaskDto[]): void {
    this.errorMessage = null;
    this.tasks = tasks || [];
    this.applyFilters();
  }

  /** ✅ Centralized error handling */
  private handleError(err: any, fallback: string): void {
    console.error(err);
    this.errorMessage = err?.message || err?.error?.message || fallback;
  }

  /** 🔹 Apply search + status filters */
  applyFilters(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredTasks = this.tasks.filter(task => {
      const matchesSearch =
        !term ||
        task.title?.toLowerCase().includes(term) ||
        task.assignedToNames?.some(name => name?.toLowerCase().includes(term)) ||
        task.departmentNames?.some(name => name?.toLowerCase().includes(term));

      const matchesStatus =
        this.statusFilter === 'SELF'
          ? task.assignedToIds?.includes(this.loggedInUserID!)
          : !this.statusFilter || task.status?.toUpperCase() === this.statusFilter;

      return matchesSearch && matchesStatus;
    });

    this.totalPages = Math.max(Math.ceil(this.filteredTasks.length / this.pageSize), 1);
    this.currentPage = 1;
  }

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

  viewTaskDetails(taskId?: number): void {
    if (taskId) this.router.navigate(['/task', taskId]);
  }

  /** ✅ Delete task with robust error handling */
  deleteTask(event: Event, taskId?: number): void {
    event.stopPropagation();
    if (!taskId || !confirm('Are you sure you want to delete this task?')) return;

    this.loading = true;
    this.subscriptions.add(
      this.apiService.deleteTask(taskId)
        .pipe(
          finalize(() => (this.loading = false)),
          catchError(err => {
            this.handleError(err, 'Failed to delete task.');
            return of({ success: false, message: 'Request failed' } as ApiResponse<null>);
          })
        )
        .subscribe(res => {
          if (res?.success) {
            this.tasks = this.tasks.filter(t => t.taskId !== taskId);
            this.applyFilters();
          } else {
            this.handleError(res, res?.message || 'Failed to delete task');
          }
        })
    );
  }

  /** ✅ Dynamic status color badge */
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
}
