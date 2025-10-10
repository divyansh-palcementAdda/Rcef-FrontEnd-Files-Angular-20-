import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { TaskDto } from '../../../Model/TaskDto';

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

  loading = true;
  errorMessage: string | null = null;

  searchTerm = '';
  statusFilter = '';

  currentPage = 1;
  pageSize = 8;
  totalPages = 1;

  constructor(
    private apiService: TaskApiService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
  // Subscribe to query params to get status (e.g. /view-tasks?status=Pending)
  this.route.queryParams.subscribe(params => {
    const status = params['status'];
    console.log('Status filter from query params:', status);
    if (status) {
      this.statusFilter = status.toUpperCase();
      this.loadTasksByStatus(this.statusFilter);
    } else {
      this.statusFilter = '';
      this.loadAllTasks();
    }
  });
}

  /** ✅ Load all tasks */
  /** ✅ Load all tasks */
  loadAllTasks(): void {
    this.loading = true;
    this.apiService.getAllTasks().subscribe({
      next: (res) => {
        // res is of type { success, message, data }
        this.handleTaskResponse(res.data || []); // pass TaskDto[] to handler
        this.loading = false;
      },
      error: (err) => this.handleError(err, 'Failed to load tasks.')
    });
  }

  /** ✅ Load tasks by specific status */
  loadTasksByStatus(status: string): void {
    this.loading = true;
    this.apiService.getTasksByStatus(status).subscribe({
      next: (res) => {
        // res is of type { success, message, data }
        this.handleTaskResponse(res.data || []); // pass TaskDto[] to handler
        this.loading = false;
      },
      error: (err) => this.handleError(err, `Failed to load ${status.toLowerCase()} tasks.`)
    });
  }


  /** 🧠 Common response handler */
  private handleTaskResponse(tasks: TaskDto[] | null): void {
    this.tasks = tasks || [];
    this.applyFilters();
    this.loading = false;
  }

  /** ⚠️ Error handler */
  private handleError(err: any, fallback: string): void {
    console.error('Task load error:', err);
    this.errorMessage = err?.error?.message || fallback;
    this.loading = false;
  }

  /** 🔍 Apply search + status filters */
  applyFilters(): void {
    this.filteredTasks = this.tasks.filter(task => {
      const matchesSearch =
        !this.searchTerm ||
        task.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.assignedToName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.departmentName?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter || task.status === this.statusFilter;
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

  /** 🔗 Navigate to details page */
  viewTaskDetails(taskId?: number): void {
    if (taskId) {
      this.router.navigate(['/tasks', taskId]);
    }
  }

  /** ❌ Delete task */
  deleteTask(event: Event, taskId?: number): void {
    event.stopPropagation();
    if (!taskId) return;

    if (confirm('Are you sure you want to delete this task?')) {
      this.apiService.deleteTask(taskId).subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.taskId !== taskId);
          this.applyFilters();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to delete task.';
        }
      });
    }
  }
}
