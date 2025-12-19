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
import { AuditLog } from '../../../Model/audit-log'; // <-- Create this model
import { forkJoin } from 'rxjs';
import { TaskStatus } from '../../../Model/TaskStatus';
import { JwtService } from '../../../Services/jwt-service';

@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-user.html',
  styleUrls: ['./view-user.css']
})
export class ViewUserComponent implements OnInit {
getTaskStatusClass(arg0: TaskStatus): string|string[]|Set<string>|{ [klass: string]: any; }|null|undefined {
throw new Error('Method not implemented.');
}
  assignNewTask() {
    this.router.navigate(['/add-task'], { queryParams: { userId: this.userId } });
  }

  viewDepartment(deptId: any) {
    this.router.navigate(['/department', deptId]);
  }

  viewTask(taskId: number) {
    this.router.navigate(['/task', taskId]);
  }

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

  // Logs
  userLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  searchTermLogs = '';
  currentPageLogs = 1;
  pageSizeLogs = 8;
  totalPagesLogs = 1;

  collapsed = {
    tasks: true,
    departments: true,
    logs: true
  };

  taskStats = [
    { label: 'Pending', count: 0, color: 'warning' },
    { label: 'Upcoming', count: 0, color: 'info' },
    { label: 'Delayed', count: 0, color: 'danger' },
    { label: 'Closed', count: 0, color: 'success' },
    { label: 'IN_PROGRESS', count: 0, color: 'primary' }
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
        userCount: users.length
      };
    });
  }

  private updateTaskStats(): void {
    this.taskStats = [
      { label: 'Pending', count: this.userTasks.filter(t => t.status === 'PENDING').length, color: 'warning' },
      { label: 'Upcoming', count: this.userTasks.filter(t => t.status === 'UPCOMING').length, color: 'info' },
      { label: 'Delayed', count: this.userTasks.filter(t => t.status === 'DELAYED').length, color: 'danger' },
      { label: 'Closed', count: this.userTasks.filter(t => t.status === 'CLOSED').length, color: 'success' },
      { label: 'IN_PROGRESS', count: this.userTasks.filter(t => t.status === 'IN_PROGRESS').length, color: 'primary' }
    ];
  }

  // Task Filters & Pagination
  applyFilters(): void {
    this.filteredTasks = this.userTasks.filter(task => {
      const matchesSearch = !this.searchTerm || task.title?.toLowerCase().includes(this.searchTerm.toLowerCase());
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

  // Logs Filters & Pagination
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
    return Array.from({ length: this.totalPagesLogs }, (_, i) => i + 1);
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

  toggleCollapse(section: 'tasks' | 'departments' | 'logs'): void {
    if (section === 'logs' && this.collapsed.logs && this.userLogs.length === 0) {
      this.loadUserLogs(); // Lazy load logs
    }
    this.collapsed[section] = !this.collapsed[section];
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
        next: () => {
          this.loadUserDetails();
        },
        error: (err) => console.error('Failed to toggle status:', err)
      });
    }
  }
}