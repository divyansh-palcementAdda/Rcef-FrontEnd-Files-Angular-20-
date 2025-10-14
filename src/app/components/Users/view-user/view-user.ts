import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { UserStatusService } from '../../../Services/user-status-service';
import { userDto } from '../../../Model/userDto';
import { TaskDto } from '../../../Model/TaskDto';

@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-user.html',
  styleUrls: ['./view-user.css']
})
export class ViewUserComponent implements OnInit {

  userId!: number;
  user: userDto | null = null;
  userTasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];

  loadingUser = true;
  loadingTasks = false;
  errorMessage: string | null = null;

  searchTerm = '';
  statusFilter = '';

  // Pagination
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;

  constructor(
    private route: ActivatedRoute,
    private userService: UserApiService,
    private taskService: TaskApiService,
    private router: Router,
    private userStatusService: UserStatusService
  ) { }

  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.userId) {
      this.errorMessage = 'Invalid user ID';
      return;
    }
    this.loadUserDetails();
  }

  toggleUserStatus(): void {
    if (this.user) {
      this.userStatusService.toggleUserStatus(this.user).then(() => this.loadUserDetails());
    }
  }

  loadUserDetails(): void {
    this.loadingUser = true;
    this.userService.getUserById(this.userId).subscribe({
      next: (res) => {
        this.user = res;
        this.loadingUser = false;
        this.loadUserTasks();
      },
      error: (err) => {
        this.loadingUser = false;
        this.errorMessage = err?.error?.message || 'Failed to load user details.';
      }
    });
  }

  loadUserTasks(): void {
    this.loadingTasks = true;
    this.taskService.getTasksByUser(this.userId).subscribe({
      next: (res) => {
        this.userTasks = res.data || [];
        this.applyFilters();
        this.loadingTasks = false;
      },
      error: (err) => {
        this.loadingTasks = false;
        console.error('Error fetching user tasks', err);
      }
    });
  }

  // 🔍 Filter tasks
  applyFilters(): void {
    this.filteredTasks = this.userTasks.filter(task => {
      const matchesSearch = !this.searchTerm ||
        task.title?.toLowerCase().includes(this.searchTerm.toLowerCase());

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

  // Pagination
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

  // When clicking on counter
  filterByStatus(status: string): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  editUser(): void {
    this.router.navigate(['/user/edit', this.userId]);
  }

  deleteUser(): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(this.userId).subscribe({
        next: () => {
          alert('User deleted successfully.');
          this.router.navigate(['/users']);
        },
        error: (err) => {
          alert(err?.error?.message || 'Failed to delete user.');
        }
      });
    }
  }
}
