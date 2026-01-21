import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { ApiService } from '../../../Services/api-service';
import { DashboardDto } from '../../../Model/DashboardDto';
import { trigger, transition, useAnimation, query, stagger } from '@angular/animations';
import { fadeInUp } from '../../../Animations/fade-in-up.animation';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { BulletinBannerComponent } from '../../Shared/bulletin-banner/bulletin-banner';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css'],
  imports: [CommonModule, RouterLink, BaseChartDirective, DatePipe, RouterLinkActive, BulletinBannerComponent,],
  animations: [
    trigger('fadeInUpStagger', [
      transition(':enter', [
        query(':enter', [
          stagger(80, [
            useAnimation(fadeInUp, {
              params: { time: '300ms ease-out' }
            })
          ])
        ], { optional: true })
      ])
    ])
  ],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {

  private dataSub?: Subscription;
  dashboardData?: DashboardDto;

  pieChartData!: ChartConfiguration<'pie'>['data'];
  barChartData!: ChartConfiguration<'bar'>['data'];
  lineChartData!: ChartConfiguration<'line'>['data'];


  // Fixed Pie Chart Options
  pieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 25,
          font: {
            size: 12,
            family: "'Inter', sans-serif"
          },
          color: '#4b5563',
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        displayColors: true,
        padding: 16,
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        boxPadding: 8,
        usePointStyle: true
      }
    },
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart'
    },
    cutout: '65%'
  };

  // Fixed Bar Chart Options
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(99, 102, 241, 0.08)'
        },
        ticks: {
          color: '#6b7280',
          font: { family: "'Inter', sans-serif", size: 11 },
          padding: 8
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#6b7280',
          font: { family: "'Inter', sans-serif", size: 11 },
          padding: 8
        }
      }
    },
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart'
    }
  };

  // Fixed Line Chart Options
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          font: { family: "'Inter', sans-serif", size: 12 },
          color: '#4b5563',
          usePointStyle: true
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(99, 102, 241, 0.08)'
        },
        ticks: {
          color: '#6b7280',
          font: { family: "'Inter', sans-serif", size: 11 },
          padding: 8
        }
      },
      x: {
        grid: {
          color: 'rgba(99, 102, 241, 0.05)'
        },
        ticks: {
          color: '#6b7280',
          font: { family: "'Inter', sans-serif", size: 11 },
          padding: 8
        }
      }
    },
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart'
    },
    elements: {
      line: {
        tension: 0.4
      },
      point: {
        radius: 6,
        hoverRadius: 8
      }
    }
  };
  currentDate = new Date();

  sidebarLinks = [
    { label: 'Dashboard', click: () => this.dashboard(), icon: 'bi-speedometer2', color: 'primary' },
    { label: 'Self Task', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-list-check', color: 'success' },
    { label: 'Add Task', route: '/add-task', icon: 'bi-plus-circle', color: 'success' },
    { label: 'Add User', route: '/add-user', icon: 'bi-person-plus', color: 'info' },
    { label: 'Add Department', route: '/add-department', icon: 'bi-building-gear', color: 'warning' },
{ 
  label: 'Add Recurring Task', 
  route: '/createRecurring', 
  icon: 'bi-arrow-repeat', 
  color: 'dark' 
},
    {
      label: 'New Tasks Requiring Approval',
      route: '/view-tasks',
      queryParams: { status: 'Approval' },
      icon: 'bi-bell',
      color: 'danger'
    }];
  trendsLoading: boolean = false;
  trendsError: string | null = '';

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthApiService,
    private jwtService: JwtService
  ) { }

  ngOnInit(): void {
    this.dataSub = this.apiService.getDashboardData().subscribe({
      next: (data) => {
        if (data) {
          this.dashboardData = data;
          this.updateCharts(data);
          this.loadTrendsData();   // ← new: load dynamic trends separately
        }
      },
      error: (err) => console.error('Error fetching dashboard data:', err)
    });
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
  }

  logout(): void {
    const refreshToken = this.authService.getRefreshToken() ?? undefined;
    this.authService.logout(refreshToken).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  dashboard(): void {
    const token = localStorage.getItem('accessToken');
    if (token && this.jwtService.isTokenValid(token)) {
      const userId = this.jwtService.getUserIdFromToken(token);
      if (userId) {
        this.authService.goToDashboard();
      } else {
        console.warn('User ID not found in token');
        this.router.navigate(['/login']);
      }
    } else {
      console.warn('Invalid or expired token');
      this.router.navigate(['/login']);
    }
  }

 statCards(d: DashboardDto) {
  const c = (color: string) => color;

  return [

    /* =======================
       CORE SUMMARY
    ======================= */
    { 
      title: 'Total Tasks', 
      value: d.totalTask, 
      color: c('dark'), 
      icon: 'bi-clipboard-check', 
      route: '/view-tasks',
      delta: d.totalTask ?? 0
    },

    { 
      title: 'Total Users', 
      value: d.totalUsers, 
      color: c('dark'), 
      icon: 'bi-people-fill', 
      route: '/viewAllUsers',
      delta: d.totalUsers ?? 0
    },

    { 
      title: 'Total Departments', 
      value: d.totalDepartments, 
      color: c('dark'), 
      icon: 'bi-building', 
      route: '/departments',
      delta: d.totalDepartments ?? 0
    },

    { 
      title: 'Active Users', 
      value: d.activeUsers, 
      color: c('info'), 
      icon: 'bi-person-check-fill', 
      route: '/viewAllUsers', 
      queryParams: { status: 'ACTIVE' },
      delta: d.activeUsers ?? 0
    },


    /* =======================
       TASK STATUS
    ======================= */
    { 
      title: 'Active Tasks', 
      value: d.activeTask, 
      color: c('primary'), 
      icon: 'bi-play-circle-fill', 
      route: '/view-tasks', 
      queryParams: { status: 'IN_PROGRESS' },
      delta: d.activeTask ?? 0
    },

    { 
      title: 'Pending Tasks', 
      value: d.pendingTask, 
      color: c('warning'), 
      icon: 'bi-hourglass-split', 
      route: '/view-tasks', 
      queryParams: { status: 'PENDING' },
      delta: d.pendingTask ?? 0
    },

    { 
      title: 'Upcoming Tasks', 
      value: d.upcomingTask, 
      color: c('info'), 
      icon: 'bi-calendar-event', 
      route: '/view-tasks', 
      queryParams: { status: 'UPCOMING' },
      delta: d.upcomingTask ?? 0
    },

    { 
      title: 'Completed Tasks', 
      value: d.completedTask, 
      color: c('success'), 
      icon: 'bi-check-circle-fill', 
      route: '/view-tasks', 
      queryParams: { status: 'CLOSED' },
      delta: d.completedTask ?? 0
    },


    /* =======================
       RISK / EXCEPTIONS
    ======================= */
    { 
      title: 'Delayed Tasks', 
      value: d.delayedTask, 
      color: c('danger'), 
      icon: 'bi-exclamation-triangle-fill', 
      route: '/view-tasks', 
      queryParams: { status: 'DELAYED' },
      delta: d.delayedTask ?? 0
    },

    { 
      title: 'Extended Tasks', 
      value: d.extendedTask, 
      color: c('warning'), 
      icon: 'bi-arrow-repeat', 
      route: '/view-tasks', 
      queryParams: { status: 'EXTENDED' },
      delta: d.extendedTask ?? 0
    },


    /* =======================
       REQUESTS
    ======================= */
    { 
      title: 'Extension Requests', 
      value: d.requestForExtension, 
      color: c('secondary'), 
      icon: 'bi-clock-history', 
      route: '/view-tasks', 
      queryParams: { status: 'REQUEST_FOR_EXTENSION' },
      delta: d.requestForExtension ?? 0
    },

    { 
      title: 'Closure Requests', 
      value: d.requestForClosure, 
      color: c('secondary'), 
      icon: 'bi-lock-fill', 
      route: '/view-tasks', 
      queryParams: { status: 'REQUEST_FOR_CLOSURE' },
      delta: d.requestForClosure ?? 0
    },


    /* =======================
       RECURRING TASKS
    ======================= */
    { 
      title: 'Recurring Parent Tasks', 
      value: d.recurringParentTask, 
      color: c('info'), 
      icon: 'bi-arrow-clockwise', 
      route: '/view-tasks', 
      queryParams: { status: 'PARENT_RECURRING' },
      delta: d.recurringParentTask ?? 0
    },

    { 
      title: 'Recurred Instance Tasks', 
      value: d.recurredInstanceTask, 
      color: c('info'), 
      icon: 'bi-arrow-repeat', 
      route: '/view-tasks', 
      queryParams: { status: 'RECURRED_INSTANCE' },
      delta: d.recurredInstanceTask ?? 0
    },


    /* =======================
       DEPARTMENTAL INSIGHTS
    ======================= */
    { 
      title: 'Departments with Zero Due Tasks', 
      value: d.zeroDueDepartments, 
      color: c('success'), 
      icon: 'bi-shield-check', 
      route: '/departments', 
      queryParams: { filter: 'ZERO_DUE' },
      delta: d.zeroDueDepartments ?? 0
    },

    { 
      title: 'My Department Tasks', 
      value: d.myDepartmentTasks, 
      color: c('primary'), 
      icon: 'bi-diagram-3-fill', 
      route: '/view-tasks', 
      queryParams: { status : 'MY_DEPARTMENT' },
      delta: d.myDepartmentTasks ?? 0
    }

  ];
}


  goToTaskPage(card: any): void {
    this.router.navigate([card.route], { queryParams: card.queryParams || {} });
  }

  private updateCharts(data: DashboardDto): void {
    // Modern Donut Chart Data
    this.pieChartData = {
      labels: ['Active', 'Pending', 'Completed', 'Delayed', 'Extended', 'Upcoming'],
      datasets: [
        {
          data: [
            data.activeTask ?? 0,
            data.pendingTask ?? 0,
            data.completedTask ?? 0,
            data.delayedTask ?? 0,
            data.extendedTask ?? 0,
            data.upcomingTask ?? 0
          ],
          backgroundColor: [
            '#6366f1', // Active - Indigo
            '#f59e0b', // Pending - Amber
            '#10b981', // Completed - Emerald
            '#ef4444', // Delayed - Red
            '#8b5cf6', // Extended - Violet
            '#06b6d4'  // Upcoming - Cyan
          ],
          borderColor: 'rgba(255, 255, 255, 0.9)',
          borderWidth: 3,
          hoverBorderColor: 'rgba(255, 255, 255, 1)',
          hoverBorderWidth: 4,
          hoverOffset: 12,
          spacing: 2
        }
      ]
    };

    // Modern Bar Chart Data
    this.barChartData = {
      labels: ['Users', 'Tasks', 'Departments', 'Active Tasks'],
      datasets: [
        {
          label: 'System Overview',
          data: [
            data.totalUsers ?? 0,
            data.totalTask ?? 0,
            data.totalDepartments ?? 0,
            data.activeTask ?? 0
          ],
          backgroundColor: [
            '#6366f1',
            '#8b5cf6',
            '#06b6d4',
            '#10b981'
          ],
          borderColor: 'rgba(255, 255, 255, 0.3)',
          borderWidth: 0,
          borderRadius: 16,
          borderSkipped: false,
          hoverBackgroundColor: [
            'rgba(99, 102, 241, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(6, 182, 212, 0.8)',
            'rgba(16, 185, 129, 0.8)'
          ],
          hoverBorderColor: 'rgba(255, 255, 255, 0.5)',
          hoverBorderWidth: 2,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        }
      ]
    };

    // Modern Line Chart Data for Trends
    this.lineChartData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Task Completion',
          data: [12, 19, 15, 25, 22, 30, 28, 35, 40, 38, 45, 50],
          borderColor: '#f082e7ff',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f082e7ff',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'User Activity',
          data: [8, 12, 18, 14, 20, 25, 22, 30, 28, 40, 20, 10],
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    };
  }
  /** New method - fetches and updates monthly trends dynamically */
  private loadTrendsData(): void {
    this.trendsLoading = true;
    this.trendsError = null;

    // Assuming your ApiService has a method for monthly stats
    // Example endpoint: /api/dashboard/monthly-trends
    this.apiService.getMonthlyTrends().subscribe({
      next: (response: { month: string; taskCompletion: number; userActivity: number }[]) => {
        this.updateLineChart(response);
        this.trendsLoading = false;
      },
      error: (err) => {
        this.trendsError = 'Failed to load activity trends';
        console.error('Trends fetch error:', err);
        this.trendsLoading = false;
      }
    });
  }

  private updateLineChart(stats: { month: string; taskCompletion: number; userActivity: number }[]): void {
    if (!stats || stats.length === 0) {
      // Fallback if no data
      this.lineChartData = {
        labels: ['No Data'],
        datasets: [
          { label: 'Task Completion', data: [0], borderColor: '#f082e7ff', backgroundColor: 'rgba(99, 102, 241, 0.1)' },
          { label: 'User Activity', data: [0], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)' }
        ]
      };
    } else {
      const months = stats.map(item => item.month);
      const taskCompletion = stats.map(item => item.taskCompletion);
      const userActivity = stats.map(item => item.userActivity);

      this.lineChartData = {
        labels: months,
        datasets: [
          {
            label: 'Task Completion',
            data: taskCompletion,
            borderColor: '#f082e7ff',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#f082e7ff',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 8
          },
          {
            label: 'User Activity',
            data: userActivity,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.12)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#8b5cf6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 8
          }
        ]
      };
    }
  }
}