import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { Department } from '../../../Model/department';
import { userDto } from '../../../Model/userDto';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

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
  loading = false;
  activeTab: 'overview' | 'tasks' | 'users' | 'subjects' | 'analytics' | 'activity' = 'overview';

  // Task Grid Variables
  allTasks: any[] = [];
  filteredTasks: any[] = [];
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
      legend: { display: true, position: 'bottom', labels: { color: '#f3f4f6' } }
    }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#f3f4f6' } },
      y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#f3f4f6' } }
    },
    plugins: {
      legend: { display: false }
    }
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#f3f4f6' } },
      y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#f3f4f6' } }
    },
    plugins: {
      legend: { display: true, labels: { color: '#f3f4f6' } }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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
    this.deptApiService.getSubDepartmentById(this.subDeptId).subscribe({
      next: (detail: SubDepartmentDetail) => {
        this.subDeptDetail = detail;
        this.allTasks = detail.allTasks || [];
        this.filteredTasks = [...this.allTasks];
        
        // Extract filter values
        this.extractFilterOptions();
        this.applyTaskFilters();
        this.updateCharts(detail);

        this.loading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load sub-department details: ' + err.message);
        this.loading = false;
      }
    });
  }

  extractFilterOptions(): void {
    const usersSet = new Set<string>();
    const subjectsSet = new Set<string>();
    const templatesSet = new Set<string>();

    this.allTasks.forEach(t => {
      if (t.assignedToNames) {
        t.assignedToNames.forEach((n: string) => usersSet.add(n));
      } else if (t.assignedToName) {
        usersSet.add(t.assignedToName);
      }
      if (t.subjectName) subjectsSet.add(t.subjectName);
      if (t.templateTitle) templatesSet.add(t.templateTitle);
    });

    this.filterUsers = Array.from(usersSet).sort();
    this.filterSubjects = Array.from(subjectsSet).sort();
    this.filterTemplates = Array.from(templatesSet).sort();
  }

  applyTaskFilters(): void {
    this.filteredTasks = this.allTasks.filter(t => {
      const matchSearch = !this.searchTerm || 
        t.title.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
        t.taskId.toString().includes(this.searchTerm);

      const matchStatus = !this.statusFilter || t.status === this.statusFilter;
      const matchPriority = !this.priorityFilter || t.priority === this.priorityFilter;
      const matchType = !this.typeFilter || t.taskType === this.typeFilter;
      
      const matchUser = !this.userFilter || 
        (t.assignedToNames && t.assignedToNames.includes(this.userFilter)) || 
        t.assignedToName === this.userFilter;

      const matchSubject = !this.subjectFilter || t.subjectName === this.subjectFilter;
      const matchTemplate = !this.templateFilter || t.templateTitle === this.templateFilter;

      return matchSearch && matchStatus && matchPriority && matchType && matchUser && matchSubject && matchTemplate;
    });

    // Sort tasks
    this.sortTasks();

    // Paginate
    this.currentPage = 1;
    this.updatePagination();
  }

  sortTasks(): void {
    this.filteredTasks.sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (this.sortColumn === 'dueDate' || this.sortColumn === 'createdAt') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  toggleSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortTasks();
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredTasks.length / this.pageSize) || 1;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    this.paginatedTasks = this.filteredTasks.slice(startIdx, startIdx + this.pageSize);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
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
    this.activeTab = 'tasks';
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
        backgroundColor: ['#fbbf24', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#ec4899', '#3b82f6', '#10b981']
      }]
    };

    // Template Distribution
    this.templateChartData = {
      labels: Object.keys(charts.templateDistribution || {}),
      datasets: [{
        label: 'Tasks Count',
        data: Object.values(charts.templateDistribution || {}),
        backgroundColor: '#6366f1'
      }]
    };

    // Subject Distribution
    this.subjectChartData = {
      labels: Object.keys(charts.subjectDistribution || {}),
      datasets: [{
        data: Object.values(charts.subjectDistribution || {}),
        backgroundColor: ['#a78bfa', '#10b981', '#3b82f6', '#fbbf24', '#f87171']
      }]
    };

    // User Distribution
    this.userChartData = {
      labels: Object.keys(charts.userDistribution || {}),
      datasets: [{
        label: 'Tasks Assigned',
        data: Object.values(charts.userDistribution || {}),
        backgroundColor: '#0ea5e9'
      }]
    };

    // Priority Distribution
    this.priorityChartData = {
      labels: Object.keys(charts.priorityDistribution || {}),
      datasets: [{
        data: Object.values(charts.priorityDistribution || {}),
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981']
      }]
    };

    // Completion Trend
    this.completionTrendChartData = {
      labels: Object.keys(charts.monthlyCompletionTrend || {}),
      datasets: [{
        label: 'Monthly Completed Tasks',
        data: Object.values(charts.monthlyCompletionTrend || {}),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3
      }]
    };

    // Creation Trend
    this.creationTrendChartData = {
      labels: Object.keys(charts.taskCreationTrend || {}),
      datasets: [{
        label: 'Monthly Created Tasks',
        data: Object.values(charts.taskCreationTrend || {}),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3
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
    this.router.navigate(['/sub-departments']);
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
}
