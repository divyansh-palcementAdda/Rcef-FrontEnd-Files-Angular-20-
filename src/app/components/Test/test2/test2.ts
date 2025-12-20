import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuditLogApiService } from '../../../Services/audit-log-api-service';
import { userDto } from '../../../Model/userDto';
import { TaskDto } from '../../../Model/TaskDto';
import { Department } from '../../../Model/department';
import { AuditLog } from '../../../Model/audit-log';
import { forkJoin } from 'rxjs';
import { TaskStatus } from '../../../Model/TaskStatus';
import { JwtService } from '../../../Services/jwt-service';

@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './test2.html',
  styleUrls: ['./test2.css']
})
export class Test2 implements OnInit {
  // User Properties
  userId!: number;
  user?: userDto;
  isLoading = true;
  errorMessage = '';
  isForbidden = false;

  // Permission Properties
  currentUserRole = '';
  currentUserDepartments: number[] = [];
  isHOD = false;

  // Task Properties
  userTasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];
  searchTerm = '';
  statusFilter = '';
  currentPage = 1;
  pageSize = 6;
  totalPages = 1;
  TaskStatus = TaskStatus;

  // Log Properties
  userLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  searchTermLogs = '';
  logsFilter = '';
  currentPageLogs = 1;
  pageSizeLogs = 10;
  totalPagesLogs = 1;

  // UI State
  activeTab: 'tasks' | 'departments' | 'activity' = 'tasks';
  Math = Math;

  taskStats = [
    { label: 'PENDING', count: 0, color: 'warning', icon: 'pending', bgColor: '#FEF3C7', textColor: '#92400E' },
    { label: 'UPCOMING', count: 0, color: 'info', icon: 'upcoming', bgColor: '#DBEAFE', textColor: '#1E40AF' },
    { label: 'DELAYED', count: 0, color: 'danger', icon: 'delayed', bgColor: '#FEE2E2', textColor: '#991B1B' },
    { label: 'CLOSED', count: 0, color: 'success', icon: 'closed', bgColor: '#D1FAE5', textColor: '#065F46' },
    { label: 'IN_PROGRESS', count: 0, color: 'primary', icon: 'in-progress', bgColor: '#E0E7FF', textColor: '#3730A3' }
  ];

  enrichedDepartments: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private userService: UserApiService,
    private taskService: TaskApiService,
    private deptService: DepartmentApiService,
    private auditLogService: AuditLogApiService
  ) { }

  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.userId || isNaN(this.userId)) {
      this.errorMessage = 'Invalid User ID';
      this.isLoading = false;
      return;
    }
    this.checkUserPermissions();
  }

  private checkUserPermissions(): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const userId = this.jwtService.getUserIdFromToken(token);
    if (!userId) {
      this.isLoading = false;
      return;
    }

    this.userService.getUserById(userId).subscribe({
      next: (currentUser) => {
        this.currentUserRole = currentUser.role;
        this.isHOD = this.currentUserRole === 'HOD';

        if (this.isHOD) {
          this.currentUserDepartments = currentUser.departmentIds || [];
          this.verifyHODAccess();
        } else {
          this.loadUserDetails();
        }
      },
      error: () => {
        this.errorMessage = 'Failed to verify permissions';
        this.isLoading = false;
      }
    });
  }

  private verifyHODAccess(): void {
    this.userService.getUserById(this.userId).subscribe({
      next: (user) => {
        const userDeptIds = user.departmentIds || [];
        const hasAccess = userDeptIds.some(id => this.currentUserDepartments.includes(id));

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
        this.enrichedDepartments = depts || [];
        this.enrichDepartmentsData();
        this.updateTaskStats();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading tasks and departments:', err);
        this.isLoading = false;
      }
    });
  }

  get startIndex(): number {
    return this.filteredTasks.length
      ? (this.currentPage - 1) * this.pageSize + 1
      : 0;
  }

  get endIndex(): number {
    return Math.min(
      this.currentPage * this.pageSize,
      this.filteredTasks.length
    );
  }

  getCompletionRate(): number {
    const completedTasks = this.userTasks.filter(task => task.status === 'CLOSED').length;
    return this.userTasks.length > 0 ? Math.round((completedTasks / this.userTasks.length) * 100) : 0;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatRole(role: string): string {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  private enrichDepartmentsData(): void {
    this.enrichedDepartments = this.enrichedDepartments.map(dept => {
      const users: userDto[] = dept.users ?? [];
      const hod = users.find((u: userDto) => u.role === 'HOD') ?? null;

      return {
        id: dept.departmentId || dept.id,
        name: dept.name,
        hodName: hod?.fullName ?? 'Not Assigned',
        userCount: users.length
      };
    });
  }

  private updateTaskStats(): void {
    this.taskStats = this.taskStats.map(stat => ({
      ...stat,
      count: this.userTasks.filter(t => t.status === stat.label).length
    }));
  }

  // Task Methods
  getPriorityClass(priority?: string): string {
    if (!priority) return 'priority-medium';
    return `priority-${priority.toLowerCase()}`;
  }

  applyFilters(): void {
    this.filteredTasks = this.userTasks.filter(task => {
      const matchesSearch = !this.searchTerm ||
        task.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesStatus = !this.statusFilter || task.status === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
    
    this.totalPages = Math.ceil(this.filteredTasks.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const maxVisiblePages = 5;
    const pages: number[] = [];

    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const half = Math.floor(maxVisiblePages / 2);
      let start = this.currentPage - half;
      let end = this.currentPage + half;

      if (start < 1) {
        start = 1;
        end = maxVisiblePages;
      }

      if (end > this.totalPages) {
        end = this.totalPages;
        start = end - maxVisiblePages + 1;
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  get paginatedTasks(): TaskDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTasks.slice(start, start + this.pageSize);
  }

  // Log Methods
  applyFiltersLogs(): void {
    this.filteredLogs = this.userLogs.filter(log => {
      const matchesSearch = !this.searchTermLogs ||
        log.action?.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        log.entity?.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(this.searchTermLogs.toLowerCase()));
      const matchesAction = !this.logsFilter || log.action === this.logsFilter;
      return matchesSearch && matchesAction;
    });
    
    this.totalPagesLogs = Math.ceil(this.filteredLogs.length / this.pageSizeLogs) || 1;
    if (this.currentPageLogs > this.totalPagesLogs) {
      this.currentPageLogs = 1;
    }
  }

  resetFiltersLogs(): void {
    this.searchTermLogs = '';
    this.logsFilter = '';
    this.applyFiltersLogs();
  }

  changePageLogs(page: number): void {
    if (page >= 1 && page <= this.totalPagesLogs) {
      this.currentPageLogs = page;
    }
  }

  getPageNumbersLogs(): number[] {
    const maxVisiblePages = 5;
    const pages: number[] = [];

    if (this.totalPagesLogs <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPagesLogs; i++) {
        pages.push(i);
      }
    } else {
      const half = Math.floor(maxVisiblePages / 2);
      let start = this.currentPageLogs - half;
      let end = this.currentPageLogs + half;

      if (start < 1) {
        start = 1;
        end = maxVisiblePages;
      }

      if (end > this.totalPagesLogs) {
        end = this.totalPagesLogs;
        start = end - maxVisiblePages + 1;
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  get paginatedLogs(): AuditLog[] {
    const start = (this.currentPageLogs - 1) * this.pageSizeLogs;
    return this.filteredLogs.slice(start, start + this.pageSizeLogs);
  }

  loadUserLogs(): void {
    if (this.userLogs.length === 0) {
      this.auditLogService.getLogsByUser(this.userId).subscribe({
        next: (logs) => {
          this.userLogs = logs || [];
          this.applyFiltersLogs();
        },
        error: (err) => {
          console.error('Error loading logs:', err);
          this.userLogs = [];
        }
      });
    }
  }

  // Navigation Methods
  goBack(): void {
    this.router.navigate(['/viewAllUsers']);
  }

  assignNewTask(): void {
    this.router.navigate(['/add-task'], { queryParams: { userId: this.userId } });
  }

  viewDepartment(deptId: any): void {
    this.router.navigate(['/department', deptId]);
  }

  viewTask(taskId: number): void {
    this.router.navigate(['/task', taskId]);
  }

  // User Management Methods
  canEditDelete(): boolean {
    return !this.isHOD && this.currentUserRole !== 'USER';
  }

  editUser(): void {
    if (this.canEditDelete()) {
      this.router.navigate(['/edit-user', this.userId]);
    } else {
      alert('You do not have permission to edit this user.');
    }
  }

  deleteUser(): void {
    if (!this.canEditDelete() || !confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    this.userService.deleteUser(this.userId).subscribe({
      next: () => {
        alert('User deleted successfully.');
        this.goBack();
      },
      error: (err) => {
        alert(err?.error?.message || 'Failed to delete user');
      }
    });
  }

  toggleUserStatus(): void {
    if (!this.canEditDelete() || !this.userId) return;

    const action = this.user?.status === 'ACTIVE' ? 'deactivate' : 'activate';
    const confirmMessage = `Are you sure you want to ${action} this user?`;

    if (!confirm(confirmMessage)) return;

    this.userService.toggleUserStatus(this.userId).subscribe({
      next: () => {
        this.loadUserDetails();
      },
      error: (err) => {
        console.error('Failed to toggle user status:', err);
        alert('Failed to update user status. Please try again.');
      }
    });
  }
}