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
  templateUrl: './test.html',
  styleUrls: ['./test.css']
})
export class Test implements OnInit {
  userId!: number;
  user?: userDto;
  isLoading = true;
  errorMessage = '';
  isForbidden = false;

  currentUserRole = '';
  currentUserDepartments: number[] = [];
  isHOD = false;

  userTasks: TaskDto[] = [];
  filteredTasks: TaskDto[] = [];
  searchTerm = '';
  statusFilter = '';
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;
  TaskStatus = TaskStatus;

  userLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  searchTermLogs = '';
  currentPageLogs = 1;
  pageSizeLogs = 8;
  totalPagesLogs = 1;

  activeSection: 'tasks' | 'departments' | 'logs' | null = null;

  taskStats = [
    { label: 'Pending', count: 0, color: 'warning', icon: 'bi-clock', key: 'PENDING' },
    { label: 'Upcoming', count: 0, color: 'info', icon: 'bi-calendar', key: 'UPCOMING' },
    { label: 'Delayed', count: 0, color: 'danger', icon: 'bi-exclamation-triangle', key: 'DELAYED' },
    { label: 'Closed', count: 0, color: 'success', icon: 'bi-check-circle', key: 'CLOSED' },
    { label: 'In Progress', count: 0, color: 'primary', icon: 'bi-play-circle', key: 'IN_PROGRESS' }
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
  ) {}

  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.userId) {
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
    if (!userId) return;

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
        this.enrichDepartments(depts);
        this.updateTaskStats();
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
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
        description: dept.description || 'No description available'
      };
    });
  }

  private updateTaskStats(): void {
    this.taskStats = this.taskStats.map(stat => ({
      ...stat,
      count: this.userTasks.filter(t => t.status === stat.key).length
    }));
  }

  getTaskStatusClass(status: TaskStatus): string {
    const statusMap: { [key in TaskStatus]?: string } = {
      'PENDING': 'bg-warning',
      'UPCOMING': 'bg-info text-dark',
      'DELAYED': 'bg-danger',
      'CLOSED': 'bg-success',
      'IN_PROGRESS': 'bg-primary'
    };
    return statusMap[status] || 'bg-secondary';
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
    const maxVisible = 5;
    const start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get paginatedTasks(): TaskDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTasks.slice(start, start + this.pageSize);
  }

  applyFiltersLogs(): void {
    this.filteredLogs = this.userLogs.filter(log => {
      const matchesSearch = !this.searchTermLogs ||
        log.action.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        log.entity.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(this.searchTermLogs.toLowerCase()));
      return matchesSearch;
    });
    this.totalPagesLogs = Math.ceil(this.filteredLogs.length / this.pageSizeLogs) || 1;
    this.currentPageLogs = 1;
  }

  resetFiltersLogs(): void {
    this.searchTermLogs = '';
    this.applyFiltersLogs();
  }

  changePageLogs(page: number): void {
    if (page >= 1 && page <= this.totalPagesLogs) this.currentPageLogs = page;
  }

  getPageNumbersLogs(): number[] {
    const maxVisible = 5;
    const start = Math.max(1, this.currentPageLogs - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPagesLogs, start + maxVisible - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get paginatedLogs(): AuditLog[] {
    const start = (this.currentPageLogs - 1) * this.pageSizeLogs;
    return this.filteredLogs.slice(start, start + this.pageSizeLogs);
  }

  private loadUserLogs(): void {
    this.auditLogService.getLogsByUser(this.userId).subscribe({
      next: (logs) => {
        this.userLogs = logs;
        this.applyFiltersLogs();
      },
      error: (err) => console.error('Error loading logs:', err)
    });
  }

  toggleSection(section: 'tasks' | 'departments' | 'logs'): void {
    if (section === 'logs' && this.userLogs.length === 0) {
      this.loadUserLogs();
    }
    
    if (this.activeSection === section) {
      this.activeSection = null;
    } else {
      this.activeSection = section;
    }
  }

  goBack(): void {
    this.router.navigate(['/viewAllUsers']);
  }

  canEditDelete(): boolean {
    return !this.isHOD;
  }

  editUser(): void {
    if (this.canEditDelete()) {
      this.router.navigate(['/edit-user', this.userId]);
    }
  }

  deleteUser(): void {
    if (!this.canEditDelete() || !confirm('Are you sure you want to delete this user?')) return;

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
        next: () => {
          this.loadUserDetails();
        },
        error: (err) => console.error('Failed to toggle status:', err)
      });
    }
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

  filterByStatus(statusKey: string): void {
    this.statusFilter = statusKey;
    this.applyFilters();
    this.activeSection = 'tasks';
  }

  getInitials(fullName: string): string {
    return fullName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
}