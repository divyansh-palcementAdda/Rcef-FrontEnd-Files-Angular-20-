import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { TaskDto } from '../../../Model/TaskDto';
import { JwtService } from '../../../Services/jwt-service';

@Component({
  selector: 'app-view-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-tasks.html',
  styleUrls: ['./view-tasks.css']
})
export class ViewTasksComponent implements OnInit {

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

  constructor(
    private apiService: TaskApiService,
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService
  ) { }

  ngOnInit(): void {
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
    });
  }

  /** Load tasks for logged-in user */
  private loadTasksByUser(): void {
    this.loading = true;
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    this.loggedInUserID = this.jwtService.getUserIdFromToken(token);
    if (!this.loggedInUserID) return;

    this.apiService.getTasksByUser(this.loggedInUserID).subscribe({
      next: res => this.handleTaskResponse(res.data || []),
      error: err => this.handleError(err, 'Failed to load your tasks.')
    });
  }

  /** Load all tasks */
  private loadAllTasks(): void {
    this.loading = true;
    this.apiService.getAllTasks().subscribe({
      next: res => this.handleTaskResponse(res.data || []),
      error: err => this.handleError(err, 'Failed to load tasks.')
    });
  }

  /** Load tasks by status */
  private loadTasksByStatus(status: string): void {
    this.loading = true;
    this.apiService.getTasksByStatus(status).subscribe({
      next: res => this.handleTaskResponse(res.data || []),
      error: err => this.handleError(err, `Failed to load ${status} tasks.`)
    });

  }

  /** Handle API response */
  private handleTaskResponse(tasks: TaskDto[]): void {
    this.tasks = tasks || [];
    console.log(this.tasks)
    this.applyFilters();
    this.loading = false;
  }

  /** Error handler */
  private handleError(err: any, fallback: string): void {
    console.error(err);
    this.errorMessage = err?.error?.message || fallback;
    this.loading = false;
  }

  /** Apply search and status filters */
  applyFilters(): void {
    this.filteredTasks = this.tasks.filter(task => {
      const matchesSearch =
        !this.searchTerm ||
        task.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.assignedToName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.departmentName?.toLowerCase().includes(this.searchTerm.toLowerCase());

      // Special case for 'SELF'
      const matchesStatus =
        this.statusFilter.toUpperCase() === 'SELF'
          ? task.assignedToId === this.loggedInUserID
          : !this.statusFilter || task.status?.toUpperCase() === this.statusFilter;

      return matchesSearch && matchesStatus;
    });

    this.totalPages = Math.ceil(this.filteredTasks.length / this.pageSize) || 1;
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

  /** Navigate to task details */
  viewTaskDetails(taskId?: number): void {
    if (taskId) this.router.navigate(['/tasks', taskId]);
  }

  /** Delete task */
  deleteTask(event: Event, taskId?: number): void {
    event.stopPropagation();
    if (!taskId) return;

    if (!confirm('Are you sure you want to delete this task?')) return;

    this.apiService.deleteTask(taskId).subscribe({
      next: () => {
        this.tasks = this.tasks.filter(t => t.taskId !== taskId);
        this.applyFilters();
      },
      error: err => this.handleError(err, 'Failed to delete task.')
    });
  }

  /** Helper for status badge class */
  getStatusClass(status?: string): string {
    switch (status) {
      case 'PENDING':
      case 'UPCOMING':
        return 'bg-warning text-dark';
      case 'DELAYED':
        return 'bg-danger blink';
      case 'REQUEST_FOR_CLOSURE':
      case 'REQUEST_FOR_EXTENSION':
        return 'bg-info';
      case 'CLOSED':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  }
}
