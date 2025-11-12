import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { userDto } from '../../../Model/userDto';
import { TaskDto } from '../../../Model/TaskDto';
import { Department } from '../../../Model/department';
import { forkJoin, of, Observable } from 'rxjs';
import { TaskStatus } from '../../../Model/TaskStatus';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';

interface TableSection {
  id: string;
  title: string;
  icon: string;
  data: any[];
  columns: string[];
  emptyMessage: string;
}

@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-user.html',
  styleUrls: ['./view-user.css']
})
export class ViewUserComponent implements OnInit {
  userId!: number;
  user?: userDto;
  isLoading = true;
  errorMessage = '';
  isForbidden = false;

  // HOD Check
  currentUserRole = '';
  currentUserDepartments: number[] = [];
  isHOD = false;

  // User Tasks
  userTasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];
  searchTerm = '';
  statusFilter = '';
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;
  TaskStatus = TaskStatus;

  // Collapsible Tables
  collapsed = {
    tasks: true,
    departments: true
  };

  // Stats
  taskStats = [
    { label: 'Pending', count: 0, color: 'warning' },
    { label: 'Upcoming', count: 0, color: 'info' },
    { label: 'Delayed', count: 0, color: 'danger' },
    { label: 'Closed', count: 0, color: 'success' }
  ];

  enrichedDepartments: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private userService: UserApiService,
    private taskService: TaskApiService,
    private deptService: DepartmentApiService,
    private authService: AuthApiService // Your auth service
  ) { }

  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.userId) {
      this.errorMessage = 'Invalid User ID';
      return;
    }

    // Check current user permissions FIRST
    this.checkUserPermissions();
  }

  /** 🔒 Check if current user can view this user */
  private checkUserPermissions(): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const userId = this.jwtService.getUserIdFromToken(token);

    if (!userId) {
      console.error('Failed to extract userId from token');
      // Handle invalid token
      return;
    }

    // Now safely use userId
    // this.userId = userId;
    this.userService.getUserById(userId).subscribe({
      next: (currentUser) => {
        this.currentUserRole = currentUser.role;
        this.isHOD = this.currentUserRole === 'HOD';

        if (this.isHOD) {
          console.log('Hod - '+this.isHOD)
          this.currentUserDepartments = currentUser.departmentIds || [];
          // Verify user belongs to HOD's departments
          this.verifyHODAccess();
        } else {
          console.log('Admin - '+this.isHOD)
          // Admin/SuperAdmin can view all
          this.loadUserDetails();
        }
      },
      error: (err) => {
        this.errorMessage = 'Failed to verify permissions';
        this.isLoading = false;
      }
    });
  }

  /** 🔐 HOD can only view users from their departments */
  private verifyHODAccess(): void {
    this.userService.getUserById(this.userId).subscribe({
      next: (user) => {
        // Check if user belongs to HOD's departments
        const userDeptIds = user.departmentIds || [];
        const hasAccess = userDeptIds.some(id =>
          this.currentUserDepartments.includes(id)
        );

        if (!hasAccess) {
          this.isForbidden = true;
          this.isLoading = false;
          return;
        }

        this.user = user;
        this.loadUserTasksAndDepts();
      },
      error: () => {
        this.isForbidden = true;
        this.isLoading = false;
      }
    });
  }

  /** Load user + tasks + departments */
  private loadUserDetails(): void {
    this.isLoading = true;
    this.userService.getUserById(this.userId).subscribe({
      next: (user) => {
        this.user = user;
        this.loadUserTasksAndDepts();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Failed to load user';
      }
    });
  }

  private loadUserTasksAndDepts(): void {
    const taskObs = this.taskService.getTasksByUser(this.userId);
    const deptObs = this.deptService.getDepartmentsByIds(this.user?.departmentIds || []);

    forkJoin([taskObs, deptObs]).subscribe({
      next: ([taskRes, depts]) => {
        this.userTasks = taskRes.data || [];
        this.enrichDepartments(depts);
        this.updateTaskStats();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading data:', err);
      }
    });
  }

  private enrichDepartments(departments: Department[]): void {
    this.enrichedDepartments = departments.map(dept => {
      const users = dept.users || [];
      const hod = users.find(u => u.role === 'HOD') || users[0];
      return {
        id: dept.departmentId,
        name: dept.name,
        hodName: hod ? hod.fullName : '—',
        userCount: users.length,
        users
      };
    });
  }

  private updateTaskStats(): void {
    this.taskStats = [
      { label: 'Pending', count: this.userTasks.filter(t => t.status === 'PENDING').length, color: 'warning' },
      { label: 'Upcoming', count: this.userTasks.filter(t => t.status === 'UPCOMING').length, color: 'info' },
      { label: 'Delayed', count: this.userTasks.filter(t => t.status === 'DELAYED').length, color: 'danger' },
      { label: 'Closed', count: this.userTasks.filter(t => t.status === 'CLOSED').length, color: 'success' }
    ];
  }

  // Filters & Pagination
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

  // Collapse Toggle
  toggleCollapse(section: 'tasks' | 'departments'): void {
    this.collapsed[section] = !this.collapsed[section];
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/viewAllUsers']);
  }

  // HOD can't edit/delete
  canEditDelete(): boolean {
    return !this.isHOD;
  }

  editUser(): void {
    if (this.canEditDelete()) {
      this.router.navigate(['/edit-user', this.userId]);
    }
  }

  deleteUser(): void {
    if (!this.canEditDelete() || !confirm('Are you sure?')) return;

    this.userService.deleteUser(this.userId).subscribe({
      next: () => {
        alert('User deleted successfully.');
        this.goBack();
      },
      error: (err) => alert(err?.error?.message || 'Delete failed')
    });
  }
toggleUserStatus(): void {
  if (this.userId) {
    this.userService.toggleUserStatus(this.userId).subscribe({
      next: (res) => {
        console.log('Status toggled:', res.message);
        this.loadUserDetails(); // Refresh user data
      },
      error: (err) => {
        console.error('Failed to toggle status:', err);
        // Optional: Show toast/notification
      }
    });
  }
}
}