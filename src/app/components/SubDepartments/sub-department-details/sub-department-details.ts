import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { Department } from '../../../Model/department';
import { userDto } from '../../../Model/userDto';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin } from 'rxjs';

Chart.register(...registerables);

interface ActivityLog {
  action: string;
  details: string;
  timestamp: string;
  performedBy: string;
}

interface SubDepartmentAnalytics {
  totalUsers: number;
  totalTeachers: number;
  totalHods: number;
  totalSubjects?: number;
  totalTasks: number;
  pendingTasks: number;
  upcomingTasks: number;
  inProgressTasks: number;
  closedTasks: number;
  delayedTasks: number;
  extendedTasks: number;
  requestForClosure: number;
  requestForExtension: number;
  approvalPending: number;
}

interface SubjectBreakdown {
  id: number;
  name: string;
  code: string;
  userCount: number;
  totalTasks: number;
  templateTasks: number;
  generalTasks: number;
  pending: number;
  completed: number;
  delayed: number;
  inProgress: number;
  closed: number;
}

interface UserBreakdown {
  userId: number;
  fullName: string;
  username: string;
  role: string;
  totalTasks: number;
  pending: number;
  completed: number;
  delayed: number;
  inProgress: number;
  approvalPending: number;
  generalTasks: number;
  templateTasks: number;
  target: number;
  achievement: number;
}

interface TemplateBreakdown {
  templateId: number;
  title: string;
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  closed: number;
  delayed: number;
  targetCount: number;
  completedCount: number;
}

interface HodInfo {
  userId: number;
  fullName: string;
  username: string;
  email: string;
  role: string;
}

interface SubDepartmentDetail {
  id: string;
  name: string;
  code: string;
  description: string;
  department?: Department;
  assignedUsers?: userDto[];
  recentActivity?: ActivityLog[];
  analytics?: SubDepartmentAnalytics;
  subjectBreakdowns?: SubjectBreakdown[];
  userBreakdowns?: UserBreakdown[];
  templateBreakdowns?: TemplateBreakdown[];
  allTasks?: any[];
  charts?: any;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  updatedByName?: string;
  hods?: HodInfo[];
}

@Component({
  selector: 'app-sub-department-details',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, FormsModule, BaseChartDirective],
  templateUrl: './sub-department-details.html',
  styleUrls: ['./sub-department-details.css']
})
export class SubDepartmentDetailsComponent implements OnInit {
  readonly Math = Math;
  subDeptId!: string;
  subDeptDetail: SubDepartmentDetail | null = null;
  
  // Loading flags
  loading = false;
  basicLoading = false;
  analyticsLoading = false;
  tasksLoading = false;
  usersLoading = false;
  subjectsLoading = false;
  activityLoading = false;
  chartsLoading = false;

  activeTab: 'overview' | 'tasks' | 'users' | 'subjects' | 'analytics' | 'activity' = 'overview';

  // Task Grid Variables
  paginatedTasks: any[] = [];
  
  // Filter Fields
  searchTerm = '';
  statusFilter = '';
  priorityFilter = '';
  typeFilter = '';
  userFilter = '';
  subjectFilter = '';
  templateFilter = '';

  // Pagination & Sorting
  sortColumn = 'dueDate';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  // Filter selection options
  filterUsers: string[] = [];
  filterSubjects: string[] = [];
  filterTemplates: string[] = [];

  // Charts configuration
  statusChartData!: ChartConfiguration['data'];
  templateChartData!: ChartConfiguration['data'];
  subjectChartData!: ChartConfiguration['data'];
  userChartData!: ChartConfiguration['data'];
  priorityChartData!: ChartConfiguration['data'];
  completionTrendChartData!: ChartConfiguration['data'];
  creationTrendChartData!: ChartConfiguration['data'];

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#0f172a', font: { size: 12 } } }
    }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: { grid: { color: '#e2e8f0' }, ticks: { color: '#64748b' } },
      y: { grid: { color: '#e2e8f0' }, ticks: { color: '#64748b' } }
    },
    plugins: {
      legend: { display: false }
    }
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: { grid: { color: '#e2e8f0' }, ticks: { color: '#64748b' } },
      y: { grid: { color: '#e2e8f0' }, ticks: { color: '#64748b' } }
    },
    plugins: {
      legend: { display: true, labels: { color: '#0f172a', font: { size: 12 } } }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private deptApiService: DepartmentApiService,
    private userApiService: UserApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.subDeptId = idParam;
      this.loadSubDepartmentDetail();
    } else {
      this.showError('Invalid sub-department ID');
      this.goBack();
    }
  }

  loadSubDepartmentDetail(): void {
    this.loading = true;
    this.basicLoading = true;
    this.analyticsLoading = true;

    forkJoin({
      basic: this.deptApiService.getSubDepartmentById(this.subDeptId),
      analytics: this.deptApiService.getSubDepartmentAnalytics(this.subDeptId)
    }).subscribe({
      next: (res: any) => {
        this.subDeptDetail = res.basic;
        if (this.subDeptDetail) {
          this.subDeptDetail.analytics = res.analytics;
        }
        this.basicLoading = false;
        this.analyticsLoading = false;
        this.loading = false;

        // Start background tasks
        this.loadFilterOptions();
        this.loadOverviewActivity();
      },
      error: (err: any) => {
        this.showError('Failed to load sub-department details: ' + err.message);
        this.basicLoading = false;
        this.analyticsLoading = false;
        this.loading = false;
      }
    });
  }

  loadOverviewActivity(): void {
    this.activityLoading = true;
    this.deptApiService.getSubDepartmentActivity(this.subDeptId, 0, 6).subscribe({
      next: (res: any) => {
        if (this.subDeptDetail) {
          this.subDeptDetail.recentActivity = res.content || [];
        }
        this.activityLoading = false;
      },
      error: () => {
        this.activityLoading = false;
      }
    });
  }

  loadFilterOptions(): void {
    // Load users breakdown for filter dropdown
    this.deptApiService.getSubDepartmentUserBreakdowns(this.subDeptId).subscribe({
      next: (users: any[]) => {
        this.filterUsers = users.map(u => u.fullName).sort();
      }
    });

    // Load subjects for subjects filter
    this.deptApiService.getSubDepartmentSubjects(this.subDeptId, '', 0, 100).subscribe({
      next: (res: any) => {
        const list = res.content || [];
        this.filterSubjects = list.map((s: any) => s.name).sort();
      }
    });

    // Load templates for templates filter
    this.deptApiService.getSubDepartmentTemplates(this.subDeptId, 0, 100).subscribe({
      next: (res: any) => {
        const list = res.content || [];
        this.filterTemplates = list.map((t: any) => t.title).sort();
      }
    });
  }

  onTabChange(tab: 'overview' | 'tasks' | 'users' | 'subjects' | 'analytics' | 'activity'): void {
    this.activeTab = tab;
    if (tab === 'tasks') {
      this.fetchTasks();
    } else if (tab === 'users') {
      this.loadUserBreakdowns();
    } else if (tab === 'subjects') {
      this.loadSubjectsBreakdown();
    } else if (tab === 'analytics') {
      this.loadChartsData();
    } else if (tab === 'activity') {
      this.loadAllActivity();
    }
  }

  fetchTasks(): void {
    this.tasksLoading = true;
    const params = {
      page: this.currentPage - 1,
      size: this.pageSize,
      search: this.searchTerm,
      status: this.statusFilter,
      priority: this.priorityFilter,
      taskType: this.typeFilter,
      sortBy: this.sortColumn,
      sortDir: this.sortDirection
    };
    this.deptApiService.getSubDepartmentTasks(this.subDeptId, params).subscribe({
      next: (res: any) => {
        this.paginatedTasks = res.content || [];
        this.totalPages = res.totalPages || 1;
        this.tasksLoading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load tasks: ' + err.message);
        this.tasksLoading = false;
      }
    });
  }

  loadUserBreakdowns(): void {
    if (this.subDeptDetail?.userBreakdowns && this.subDeptDetail.userBreakdowns.length > 0) return;
    this.usersLoading = true;
    this.deptApiService.getSubDepartmentUserBreakdowns(this.subDeptId).subscribe({
      next: (users: UserBreakdown[]) => {
        if (this.subDeptDetail) {
          this.subDeptDetail.userBreakdowns = users;
        }
        this.usersLoading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load user breakdown: ' + err.message);
        this.usersLoading = false;
      }
    });
  }

  loadSubjectsBreakdown(): void {
    if (this.subDeptDetail?.subjectBreakdowns && this.subDeptDetail.subjectBreakdowns.length > 0) return;
    this.subjectsLoading = true;
    this.deptApiService.getSubDepartmentSubjects(this.subDeptId, '', 0, 100).subscribe({
      next: (res: any) => {
        if (this.subDeptDetail) {
          this.subDeptDetail.subjectBreakdowns = res.content || [];
        }
        this.subjectsLoading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load subjects: ' + err.message);
        this.subjectsLoading = false;
      }
    });
  }

  loadChartsData(): void {
    if (this.statusChartData) return;
    this.chartsLoading = true;
    this.deptApiService.getSubDepartmentCharts(this.subDeptId).subscribe({
      next: (charts: any) => {
        if (this.subDeptDetail) {
          this.subDeptDetail.charts = charts;
        }
        this.updateCharts(this.subDeptDetail);
        this.chartsLoading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load charts: ' + err.message);
        this.chartsLoading = false;
      }
    });
  }

  loadAllActivity(): void {
    this.activityLoading = true;
    this.deptApiService.getSubDepartmentActivity(this.subDeptId, 0, 50).subscribe({
      next: (res: any) => {
        if (this.subDeptDetail) {
          this.subDeptDetail.recentActivity = res.content || [];
        }
        this.activityLoading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load activity logs: ' + err.message);
        this.activityLoading = false;
      }
    });
  }

  applyTaskFilters(): void {
    this.currentPage = 1;
    this.fetchTasks();
  }

  toggleSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.fetchTasks();
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.fetchTasks();
    }
  }

  getPageArray(): number[] {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(this.currentPage - half, 1);
    let end = Math.min(start + maxVisible - 1, this.totalPages);
    if (end - start + 1 < maxVisible) start = Math.max(end - maxVisible + 1, 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  resetAllFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.priorityFilter = '';
    this.typeFilter = '';
    this.userFilter = '';
    this.subjectFilter = '';
    this.templateFilter = '';
    this.applyTaskFilters();
  }

  filterByCard(type: string, value: string): void {
    this.onTabChange('tasks');
    this.resetAllFilters();
    if (type === 'status') {
      this.statusFilter = value;
    } else if (type === 'priority') {
      this.priorityFilter = value;
    } else if (type === 'user') {
      this.userFilter = value;
    } else if (type === 'subject') {
      this.subjectFilter = value;
    } else if (type === 'template') {
      this.templateFilter = value;
    }
    this.applyTaskFilters();
  }

  updateCharts(detail: any): void {
    if (!detail || !detail.charts) return;
    const charts = detail.charts;

    // Status Distribution
    this.statusChartData = {
      labels: Object.keys(charts.statusDistribution || {}),
      datasets: [{
        data: Object.values(charts.statusDistribution || {}),
        backgroundColor: ['#f59e0b', '#06b6d4', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#3b82f6', '#059669'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    // Template Distribution
    this.templateChartData = {
      labels: Object.keys(charts.templateDistribution || {}),
      datasets: [{
        label: 'Tasks Count',
        data: Object.values(charts.templateDistribution || {}),
        backgroundColor: '#4f46e5',
        borderRadius: 6
      }]
    };

    // Subject Distribution
    this.subjectChartData = {
      labels: Object.keys(charts.subjectDistribution || {}),
      datasets: [{
        data: Object.values(charts.subjectDistribution || {}),
        backgroundColor: ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#f43f5e'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    // User Distribution
    this.userChartData = {
      labels: Object.keys(charts.userDistribution || {}),
      datasets: [{
        label: 'Tasks Assigned',
        data: Object.values(charts.userDistribution || {}),
        backgroundColor: '#06b6d4',
        borderRadius: 6
      }]
    };

    // Priority Distribution
    this.priorityChartData = {
      labels: Object.keys(charts.priorityDistribution || {}),
      datasets: [{
        data: Object.values(charts.priorityDistribution || {}),
        backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    // Completion Trend
    this.completionTrendChartData = {
      labels: Object.keys(charts.monthlyCompletionTrend || {}),
      datasets: [
        {
          label: 'Completed Tasks',
          data: Object.values(charts.monthlyCompletionTrend || {}),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Created Tasks',
          data: Object.values(charts.taskCreationTrend || {}),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4f46e5'
        }
      ]
    };

    // Creation Trend
    this.creationTrendChartData = {
      labels: Object.keys(charts.taskCreationTrend || {}),
      datasets: [{
        label: 'Monthly Created Tasks',
        data: Object.values(charts.taskCreationTrend || {}),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4f46e5'
      }]
    };
  }

  viewTaskDetails(taskId: number): void {
    this.router.navigate(['/task', taskId]);
  }

  viewUserDetails(userId: number): void {
    this.router.navigate(['/user', userId]);
  }

  viewSubjectDetails(subjectId: number): void {
    this.router.navigate(['/subject', subjectId]);
  }

  goBack(): void {
    this.location.back();
  }

  showError(msg: string): void {
    this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: ['snackbar-error'] });
  }

  getRoleBadgeClass(role: string): string {
    if (!role) return '';
    const r = role.toLowerCase();
    if (r.includes('teacher')) return 'role-teacher';
    if (r.includes('hod')) return 'role-hod';
    if (r.includes('sub_admin') || r.includes('admin')) return 'role-admin';
    if (r.includes('super_admin')) return 'role-super';
    return '';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  }

  getHodInitials(fullName: string): string {
    if (!fullName) return '?';
    return fullName
      .trim()
      .split(' ')
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  }
}
