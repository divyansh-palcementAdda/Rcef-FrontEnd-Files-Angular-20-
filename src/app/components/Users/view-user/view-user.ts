import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService, TemplateTaskSummaryDto } from '../../../Services/UserApiService';
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
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';

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

  // ── Task Type Breakdown (from API) ──
  taskTypeSummary: TemplateTaskSummaryDto[] = [
    { templateTitle: 'Meeting Task',      count: 0 },
    { templateTitle: 'Consultancy Task',  count: 0 },
    { templateTitle: 'Visits Task',       count: 0 },
    { templateTitle: 'Fees Task',         count: 0 },
    { templateTitle: 'Forms Task',        count: 0 },
  ];
  taskTypeFilter = '';        // holds the selected templateTitle value
  loadingTypeSummary = false;

  /**
   * Keyword → icon/CSS mapping.
   * Matched by doing a case-insensitive substring check on templateTitle.
   */
  private readonly typeKeywords: Array<{ keyword: string; icon: string; cssClass: string }> = [
    { keyword: 'meeting',     icon: 'bi-people-fill',            cssClass: 'task-type-meeting' },
    { keyword: 'consultancy', icon: 'bi-chat-square-text-fill',  cssClass: 'task-type-consultancy' },
    { keyword: 'visit',       icon: 'bi-geo-alt-fill',           cssClass: 'task-type-visits' },
    { keyword: 'fee',         icon: 'bi-cash-coin',              cssClass: 'task-type-fees' },
    { keyword: 'form',        icon: 'bi-file-earmark-text-fill', cssClass: 'task-type-forms' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jwtService: JwtService,
    private userService: UserApiService,
    private taskService: TaskApiService,
    private deptService: DepartmentApiService,
    private auditLogService: AuditLogApiService,
    private confirmDialog: ConfirmDialogService
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
        this.loadTaskTypeSummary();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.isLoading = false;
      }
    });
  }

  /** The 5 default card definitions (always shown, count updated from API) */
  private readonly defaultTypeCards: TemplateTaskSummaryDto[] = [
    { templateTitle: 'Meeting Task',      count: 0 },
    { templateTitle: 'Consultancy Task',  count: 0 },
    { templateTitle: 'Visits Task',       count: 0 },
    { templateTitle: 'Fees Task',         count: 0 },
    { templateTitle: 'Forms Task',        count: 0 },
  ];

  /** Fetch template-task-summary; always show 5 cards (merge with defaults) */
  private loadTaskTypeSummary(): void {
    this.loadingTypeSummary = true;
    this.userService.getUserTaskTemplateSummary(this.userId).subscribe({
      next: (data) => {
        const apiData = data || [];
        if (apiData.length > 0) {
          // API returned real data — use it directly
          this.taskTypeSummary = apiData;
        } else {
          // API returned empty — show defaults with count 0
          this.taskTypeSummary = [...this.defaultTypeCards];
        }
        this.loadingTypeSummary = false;
      },
      error: (err) => {
        console.warn('Could not load task type summary:', err);
        // On failure: try client-side fallback first, then defaults
        const fallback = this.buildFallbackTypeSummary();
        this.taskTypeSummary = fallback.length > 0 ? fallback : [...this.defaultTypeCards];
        this.loadingTypeSummary = false;
      }
    });
  }

  /** Fallback: group loaded tasks by their template title when API fails */
  private buildFallbackTypeSummary(): TemplateTaskSummaryDto[] {
    const countMap = new Map<string, number>();
    this.userTasks.forEach(t => {
      const title = t.template?.title || t.templateId?.toString() || 'Other';
      countMap.set(title, (countMap.get(title) || 0) + 1);
    });
    return Array.from(countMap.entries()).map(([templateTitle, count]) => ({ templateTitle, count }));
  }

  /** Returns Bootstrap icon class by matching keywords in templateTitle */
  getTypeIcon(templateTitle: string): string {
    const lower = templateTitle.toLowerCase();
    const match = this.typeKeywords.find(k => lower.includes(k.keyword));
    return match?.icon ?? 'bi-tag';
  }

  /** Returns CSS modifier class by matching keywords in templateTitle */
  getTypeCssClass(templateTitle: string): string {
    const lower = templateTitle.toLowerCase();
    const match = this.typeKeywords.find(k => lower.includes(k.keyword));
    return match?.cssClass ?? 'task-type-default';
  }

  /** The card label is simply the templateTitle returned by the API */
  getTypeLabel(summary: TemplateTaskSummaryDto): string {
    return summary.templateTitle;
  }

  /** Toggle task-type filter; clicking the active card again clears it */
  selectTaskType(templateTitle: string): void {
    this.taskTypeFilter = (this.taskTypeFilter === templateTitle) ? '' : templateTitle;
    this.setActiveTab('tasks');
    this.applyFilters();
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
      'PENDING':     'task-status-pending',
      'UPCOMING':    'task-status-upcoming',
      'DELAYED':     'task-status-delayed',
      'CLOSED':      'task-status-closed',
      'IN_PROGRESS': 'task-status-in-progress'
    };
    return map[status] || 'task-status-default';
  }

  applyFilters(): void {
    this.filteredTasks = this.userTasks.filter(task => {
      const matchesSearch = !this.searchTerm ||
        task.title?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesStatus = !this.statusFilter || task.status === this.statusFilter;
      // Match against task.template?.title (the field the API populates on each task)
      const matchesTemplate = !this.taskTypeFilter ||
        (task.template?.title || '').toLowerCase() === this.taskTypeFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesTemplate;
    });
    this.totalPages = Math.ceil(this.filteredTasks.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.taskTypeFilter = '';
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
    }
  }

  deleteUser(): void {
    if (!this.canEditDelete()) return;

    this.confirmDialog.confirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {
      if (!confirmed) return;
      this.userService.deleteUser(this.userId).subscribe({
        next: () => {
          this.goBack();
        },
        error: (err) => {
          this.errorMessage = err?.error?.message || 'Failed to delete user';
        }
      });
    });
  }

  toggleUserStatus(): void {
    if (!this.canEditDelete() || !this.userId) return;

    const action = this.user?.status === 'ACTIVE' ? 'deactivate' : 'activate';
    const actionLabel = this.user?.status === 'ACTIVE' ? 'Deactivate' : 'Activate';

    this.confirmDialog.confirm({
      title: `${actionLabel} User`,
      message: `Are you sure you want to ${action} this user?`,
      confirmText: actionLabel,
      cancelText: 'Cancel',
      type: this.user?.status === 'ACTIVE' ? 'danger' : 'warning'
    }).then(confirmed => {
      if (!confirmed) return;
      this.userService.toggleUserStatus(this.userId).subscribe({
        next: () => {
          this.loadUserDetails();
        },
        error: (err) => {
          console.error('Failed to toggle user status:', err);
          this.errorMessage = 'Failed to update user status.';
        }
      });
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