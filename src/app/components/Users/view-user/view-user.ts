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
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-view-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-user.html',
  styleUrls: ['./view-user.css'],
})
export class ViewUserComponent implements OnInit {
  
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
  pageSize = 6;
  totalPages = 1;
  TaskStatus = TaskStatus;
  
  userLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  searchTermLogs = '';
  currentPageLogs = 1;
  pageSizeLogs = 6;
  totalPagesLogs = 1;
  
  activeTab: 'tasks' | 'departments' | 'logs' = 'tasks';
  
  taskStats = [
    { label: 'PENDING', count: 0, icon: 'bi-clock', color: '#F59E0B', gradient: 'from-amber-500 to-orange-500' },
    { label: 'UPCOMING', count: 0, icon: 'bi-calendar-event', color: '#0EA5E9', gradient: 'from-cyan-500 to-blue-500' },
    { label: 'DELAYED', count: 0, icon: 'bi-exclamation-triangle', color: '#EF4444', gradient: 'from-red-500 to-pink-500' },
    { label: 'CLOSED', count: 0, icon: 'bi-check-circle', color: '#10B981', gradient: 'from-emerald-500 to-green-500' },
    { label: 'IN_PROGRESS', count: 0, icon: 'bi-arrow-repeat', color: '#6366F1', gradient: 'from-indigo-500 to-purple-500' }
  ];
  
  enrichedDepartments: any[] = [];
  recentActivity: any[] = [];
  loadingLogs = false;

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

   loadUserDetails(): void {
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
    forkJoin({
      tasks: this.taskService.getTasksByUser(this.userId),
      departments: this.deptService.getDepartmentsByIds(this.user?.departmentIds || [])
    }).subscribe({
      next: ({ tasks, departments }) => {
        this.userTasks = tasks.data || [];
        this.enrichedDepartments = departments || [];
        this.prepareDepartments();
        this.updateTaskStats();
        this.applyFilters();
        this.loadRecentActivity();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.isLoading = false;
      }
    });
  }

  private prepareDepartments(): void {
    this.enrichedDepartments = this.enrichedDepartments.map(dept => ({
      id: dept.departmentId || dept.id,
      name: dept.name,
      hodName: dept.users?.find((u: any) => u.role === 'HOD')?.fullName || 'Not Assigned',
      userCount: dept.users?.length || 0,
      color: this.getRandomColor()
    }));
  }

  private getRandomColor(): string {
    const colors = [
      'bg-gradient-to-r from-blue-500 to-cyan-400',
      'bg-gradient-to-r from-purple-500 to-pink-500',
      'bg-gradient-to-r from-emerald-500 to-teal-400',
      'bg-gradient-to-r from-amber-500 to-orange-400',
      'bg-gradient-to-r from-rose-500 to-pink-400',
      'bg-gradient-to-r from-indigo-500 to-purple-400'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private updateTaskStats(): void {
    this.taskStats = [
      { label: 'PENDING', count: this.userTasks.filter(t => t.status === 'PENDING').length, icon: 'bi-clock', color: '#F59E0B', gradient: 'from-amber-500 to-orange-500' },
      { label: 'UPCOMING', count: this.userTasks.filter(t => t.status === 'UPCOMING').length, icon: 'bi-calendar-event', color: '#0EA5E9', gradient: 'from-cyan-500 to-blue-500' },
      { label: 'DELAYED', count: this.userTasks.filter(t => t.status === 'DELAYED').length, icon: 'bi-exclamation-triangle', color: '#EF4444', gradient: 'from-red-500 to-pink-500' },
      { label: 'CLOSED', count: this.userTasks.filter(t => t.status === 'CLOSED').length, icon: 'bi-check-circle', color: '#10B981', gradient: 'from-emerald-500 to-green-500' },
      { label: 'IN_PROGRESS', count: this.userTasks.filter(t => t.status === 'IN_PROGRESS').length, icon: 'bi-arrow-repeat', color: '#6366F1', gradient: 'from-indigo-500 to-purple-500' }
    ];
  }

  getTaskStatusClass(status: string): string {
    const map: any = {
      'PENDING': 'border-amber-200 bg-amber-50 text-amber-800',
      'UPCOMING': 'border-blue-200 bg-blue-50 text-blue-800',
      'DELAYED': 'border-red-200 bg-red-50 text-red-800',
      'CLOSED': 'border-emerald-200 bg-emerald-50 text-emerald-800',
      'IN_PROGRESS': 'border-indigo-200 bg-indigo-50 text-indigo-800'
    };
    return map[status] || 'border-gray-200 bg-gray-50 text-gray-800';
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
    if (this.currentPage > this.totalPages) this.currentPage = 1;
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
    const maxVisible = 5;
    const pages: number[] = [];
    
    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, this.currentPage - 2);
      let end = Math.min(this.totalPages, start + maxVisible - 1);
      
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    
    return pages;
  }

  get paginatedTasks(): TaskDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTasks.slice(start, start + this.pageSize);
  }

  applyFiltersLogs(): void {
    this.filteredLogs = this.userLogs.filter(log => {
      const matchesSearch = !this.searchTermLogs ||
        log.action?.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        log.entity?.toLowerCase().includes(this.searchTermLogs.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(this.searchTermLogs.toLowerCase()));
      return matchesSearch;
    });
    this.totalPagesLogs = Math.ceil(this.filteredLogs.length / this.pageSizeLogs) || 1;
    if (this.currentPageLogs > this.totalPagesLogs) this.currentPageLogs = 1;
  }

  resetFiltersLogs(): void {
    this.searchTermLogs = '';
    this.applyFiltersLogs();
  }

  changePageLogs(page: number): void {
    if (page >= 1 && page <= this.totalPagesLogs) {
      this.currentPageLogs = page;
    }
  }

  getPageNumbersLogs(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];
    
    if (this.totalPagesLogs <= maxVisible) {
      for (let i = 1; i <= this.totalPagesLogs; i++) pages.push(i);
    } else {
      let start = Math.max(1, this.currentPageLogs - 2);
      let end = Math.min(this.totalPagesLogs, start + maxVisible - 1);
      
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    
    return pages;
  }

  get paginatedLogs(): AuditLog[] {
    const start = (this.currentPageLogs - 1) * this.pageSizeLogs;
    return this.filteredLogs.slice(start, start + this.pageSizeLogs);
  }

  private loadRecentActivity(): void {
    this.loadingLogs = true;
    this.auditLogService.getLogsByUser(this.userId).subscribe({
      next: (logs) => {
        this.userLogs = logs || [];
        this.recentActivity = this.userLogs.slice(0, 5).map(log => ({
          action: log.action,
          entity: log.entity,
          timestamp: log.timestamp,
          icon: this.getActivityIcon(log.action),
          color: this.getActivityColor(log.action)
        }));
        this.applyFiltersLogs();
        this.loadingLogs = false;
      },
      error: (err) => {
        console.error('Error loading logs:', err);
        this.userLogs = [];
        this.loadingLogs = false;
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
formatTime(timestamp: string | Date): string {
  if (!timestamp) return '';

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}


   getActivityIcon(action: string): string {
    const map: any = {
      'CREATE': 'bi-plus-circle',
      'UPDATE': 'bi-pencil-square',
      'DELETE': 'bi-trash',
      'LOGIN': 'bi-box-arrow-in-right',
      'LOGOUT': 'bi-box-arrow-right',
      'COMPLETE': 'bi-check-circle'
    };
    return map[action] || 'bi-activity';
  }

   getActivityColor(action: string): string {
    const map: any = {
      'CREATE': 'text-emerald-600 bg-emerald-50',
      'UPDATE': 'text-blue-600 bg-blue-50',
      'DELETE': 'text-red-600 bg-red-50',
      'LOGIN': 'text-purple-600 bg-purple-50',
      'LOGOUT': 'text-gray-600 bg-gray-50',
      'COMPLETE': 'text-green-600 bg-green-50'
    };
    return map[action] || 'text-gray-600 bg-gray-50';
  }

  setActiveTab(tab: 'tasks' | 'departments' | 'logs'): void {
    this.activeTab = tab;
    if (tab === 'logs' && this.userLogs.length === 0) {
      this.loadRecentActivity();
    }
  }

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
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    this.userService.toggleUserStatus(this.userId).subscribe({
      next: () => {
        this.loadUserDetails();
      },
      error: (err) => {
        console.error('Failed to toggle user status:', err);
        alert('Failed to update user status.');
      }
    });
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}