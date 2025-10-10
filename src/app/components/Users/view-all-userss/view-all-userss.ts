import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { userDto } from '../../../Model/userDto';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../Services/UserApiService';

@Component({
  selector: 'app-view-all-users',
  templateUrl: './view-all-userss.html',
  styleUrls: ['./view-all-userss.css'],
  imports: [CommonModule,FormsModule]
})
export class ViewAllUserss implements OnInit {

  // All users from API
  users: userDto[] = [];
   
  // Users after search/filter
  filteredUsers: userDto[] = [];

  // UI States
  errorMessage: string | null = null;
  loading: boolean = true;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;

  // Filters
  searchTerm: string = '';
  statusFilter: string = '';

  constructor(private apiService: UserApiService, private router: Router,private route: ActivatedRoute,
) {}

  ngOnInit(): void {
    // Subscribe to query params to get status (e.g. /view-users?status=Active)
  this.route.queryParams.subscribe(params => {
    const status = params['status'];
    console.log('Status filter from query params:', status);
    if (status) {
      this.statusFilter = status.toUpperCase();
      this.loadUsersByStatus(this.statusFilter);
    } else {
      this.statusFilter = '';
      this.loadUsers();
    }
  });
  }

  /** Load all users from API */
  loadUsers(): void {
    this.loading = true;
    this.errorMessage = null;

    this.apiService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users || [];
        console.log('Fetched users:', this.users);
        this.applyFilters();
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Failed to load users.';
        this.loading = false;
      }
    });
  }
  loadUsersByStatus(status: string): void {
    this.loading = true;
    this.errorMessage = null;
    this.apiService.getAllUsersByStatus(status).subscribe({
      next: (users) => {
        this.users = users || []; 
        console.log('Fetched users by status:', this.users);
        this.applyFilters();
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Failed to load users by status.'; 
        this.loading = false;
      }
    });
  }

  /** Apply search and status filters */
  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !this.searchTerm ||
        user.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter || user.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });

    this.totalPages = Math.ceil(this.filteredUsers.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  /** Reset filters */
  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.applyFilters();
  }

  /** Change pagination page */
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  /** Generate array of page numbers for pagination */
  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  /** Get paginated users for current page */
  get paginatedUsers(): userDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  /** Navigate to user details page */
  goToUser(userId: number): void {
    this.router.navigate(['/user', userId]);
  }

  /** View user (button click) */
  viewUser(event: Event, userId: number): void {
    event.stopPropagation();
    this.router.navigate(['/user', userId]);
  }

  /** Edit user (button click) */
  editUser(event: Event, userId: number): void {
    event.stopPropagation();
    this.router.navigate(['/user/edit', userId]);
  }

  /** Delete user (button click) */
  deleteUser(event: Event, userId: number): void {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this user?')) {
      this.apiService.deleteUser(userId).subscribe({
        next: () => {
          // Remove from arrays and refresh filters/pagination
          this.users = this.users.filter(u => u.userId !== userId);
          this.applyFilters();
        },
        error: (err: any) => {
          alert(err?.error?.message || 'Failed to delete user.');
        }
      });
    }
  }
}
