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
  departmentChartData!: ChartConfiguration<'bar'>['data'];
  radarChartData!: ChartConfiguration<'radar'>['data'];
  bubbleChartData!: ChartConfiguration<'bubble'>['data'];
  completionChartData!: ChartConfiguration<'bar'>['data'];
  doughnutChartData!: ChartConfiguration<'doughnut'>['data'];
  polarChartData!: ChartConfiguration<'polarArea'>['data'];
  mixedChartData!: ChartConfiguration<'line'>['data'];

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

  // Department Chart Options
  departmentChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
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
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(99, 102, 241, 0.08)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 } }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 } }
      }
    },
    animation: { duration: 1500, easing: 'easeInOutQuart' }
  };

  // Radar Chart Options
  radarChartOptions: ChartConfiguration<'radar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#4b5563' }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { size: 13, family: "'Inter', sans-serif" }
      }
    },
    scales: {
      r: {
        grid: { color: 'rgba(99, 102, 241, 0.1)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 10 } }
      }
    },
    animation: { duration: 1500, easing: 'easeInOutQuart' }
  };

  // Bubble Chart Options
  bubbleChartOptions: ChartConfiguration<'bubble'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#4b5563' } },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        titleFont: { size: 13, family: "'Inter', sans-serif" }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(99, 102, 241, 0.08)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 } }
      },
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(99, 102, 241, 0.08)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 } }
      }
    },
    animation: { duration: 1500, easing: 'easeInOutQuart' }
  };

  // Completion Rate Chart Options
  completionChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        titleFont: { size: 13, family: "'Inter', sans-serif" }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        grid: { color: 'rgba(99, 102, 241, 0.08)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 }, callback: (value) => value + '%' }
      },
      y: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 } }
      }
    },
    animation: { duration: 1500, easing: 'easeInOutQuart' }
  };

  // Doughnut Chart Options
  doughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          font: { size: 11, family: "'Inter', sans-serif" },
          color: '#4b5563',
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { size: 13, family: "'Inter', sans-serif" }
      }
    },
    animation: { duration: 1500, easing: 'easeInOutQuart' },
    cutout: '70%'
  };

  // Polar Chart Options
  polarChartOptions: ChartConfiguration<'polarArea'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#4b5563' }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleFont: { size: 13, family: "'Inter', sans-serif" }
      }
    },
    scales: {
      r: {
        grid: { color: 'rgba(99, 102, 241, 0.1)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 10 } }
      }
    },
    animation: { duration: 1500, easing: 'easeInOutQuart' }
  };

  // Mixed Chart Options
  mixedChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#4b5563', usePointStyle: true }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        titleFont: { size: 14, family: "'Inter', sans-serif" }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(99, 102, 241, 0.08)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 }, padding: 8 }
      },
      x: {
        grid: { color: 'rgba(99, 102, 241, 0.05)' },
        ticks: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 }, padding: 8 }
      }
    },
    animation: { duration: 1500, easing: 'easeInOutQuart' },
    elements: {
      line: { tension: 0.4 },
      point: { radius: 5, hoverRadius: 7 }
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
      label: 'New Tasks Requiring Approval',
      route: '/view-tasks',
      queryParams: { status: 'Approval' },
      icon: 'bi-bell',
      color: 'danger'
    }];

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
      // Core Totals
      { title: 'Total Tasks', value: d.totalTask, color: c('dark'), icon: 'bi-clipboard2-data', route: '/view-tasks', delta: 5 },
      { title: 'Total Users', value: d.totalUsers, color: c('dark'), icon: 'bi-people', route: '/viewAllUsers', delta: 2 },
      { title: 'Total Departments', value: d.totalDepartments, color: c('dark'), icon: 'bi-building', route: '/departments', delta: 0 },
      { title: 'Active Users', value: d.activeUsers, color: c('info'), icon: 'bi-person-check-fill', route: '/viewAllUsers', queryParams: { status: 'ACTIVE' }, delta: 6 },

      // Task Flow
      { title: 'Active Tasks', value: d.activeTask, color: c('primary'), icon: 'bi-play-circle', route: '/view-tasks', queryParams: { status: 'IN_PROGRESS' }, delta: 7 },
      { title: 'Pending Tasks', value: d.pendingTask, color: c('warning'), icon: 'bi-hourglass-split', route: '/view-tasks', queryParams: { status: 'PENDING' }, delta: -1 },
      { title: 'Upcoming Tasks', value: d.upcomingTask, color: c('info'), icon: 'bi-calendar3', route: '/view-tasks', queryParams: { status: 'Upcoming' }, delta: 4 },
      { title: 'Completed Tasks', value: d.completedTask, color: c('success'), icon: 'bi-check2-circle', route: '/view-tasks', queryParams: { status: 'CLOSED' }, delta: 8 },

      // Issues & Extensions
      { title: 'Delayed Tasks', value: d.delayedTask, color: c('danger'), icon: 'bi-exclamation-triangle-fill', route: '/view-tasks', queryParams: { status: 'Delayed' }, delta: 3 },
      { title: 'Extended Tasks', value: d.extendedTask, color: c('warning'), icon: 'bi-arrow-repeat', route: '/view-tasks', queryParams: { status: 'Extended' }, delta: 2 },

      // Requests
      { title: 'Extension Requests', value: d.requestForExtension, color: c('secondary'), icon: 'bi-clock-history', route: '/view-tasks', queryParams: { status: 'REQUEST_FOR_EXTENSION' }, delta: 1 },
      { title: 'Closure Requests', value: d.requestForClosure, color: c('secondary'), icon: 'bi-lock-fill', route: '/view-tasks', queryParams: { status: 'REQUEST_FOR_CLOSURE' }, delta: -2 },
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
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun','July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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

    // Department Performance Chart
    this.departmentChartData = {
      labels: ['HR', 'IT', 'Finance', 'Operations', 'Marketing'],
      datasets: [
        {
          label: 'Completed Tasks',
          data: [
            (data.completedTask ?? 0) * 0.2,
            (data.completedTask ?? 0) * 0.25,
            (data.completedTask ?? 0) * 0.18,
            (data.completedTask ?? 0) * 0.22,
            (data.completedTask ?? 0) * 0.15
          ],
          backgroundColor: '#6366f1',
          borderRadius: 8,
          hoverBackgroundColor: 'rgba(99, 102, 241, 0.8)'
        }
      ]
    };

    // Radar Chart - Task Priority Matrix
    this.radarChartData = {
      labels: ['High Priority', 'Medium Priority', 'Low Priority', 'Urgent', 'Normal', 'Flexible'],
      datasets: [
        {
          label: 'Current Tasks',
          data: [
            (data.totalTask ?? 0) * 0.25,
            (data.totalTask ?? 0) * 0.35,
            (data.totalTask ?? 0) * 0.2,
            (data.totalTask ?? 0) * 0.1,
            (data.totalTask ?? 0) * 0.07,
            (data.totalTask ?? 0) * 0.03
          ],
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          borderWidth: 2,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5
        }
      ]
    };

    // Bubble Chart - User Engagement
    this.bubbleChartData = {
      datasets: [
        {
          label: 'Department A',
          data: [
            { x: 10, y: (data.activeUsers ?? 0) * 0.3, r: 15 },
            { x: 20, y: (data.activeUsers ?? 0) * 0.25, r: 12 }
          ],
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: '#6366f1',
          borderWidth: 2
        },
        {
          label: 'Department B',
          data: [
            { x: 30, y: (data.activeUsers ?? 0) * 0.35, r: 18 },
            { x: 40, y: (data.activeUsers ?? 0) * 0.2, r: 10 }
          ],
          backgroundColor: 'rgba(139, 92, 246, 0.6)',
          borderColor: '#8b5cf6',
          borderWidth: 2
        },
        {
          label: 'Department C',
          data: [
            { x: 50, y: (data.activeUsers ?? 0) * 0.28, r: 14 }
          ],
          backgroundColor: 'rgba(236, 72, 153, 0.6)',
          borderColor: '#ec4899',
          borderWidth: 2
        }
      ]
    };

    // Completion Rate Chart
    this.completionChartData = {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [
        {
          label: 'Completion Rate %',
          data: [
            Math.round(((data.completedTask ?? 0) / (data.totalTask ?? 1)) * 100),
            Math.round(((data.completedTask ?? 0) / (data.totalTask ?? 1)) * 100) + 5,
            Math.round(((data.completedTask ?? 0) / (data.totalTask ?? 1)) * 100) + 8,
            Math.round(((data.completedTask ?? 0) / (data.totalTask ?? 1)) * 100) + 10
          ],
          backgroundColor: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981'],
          borderRadius: 8,
          hoverBackgroundColor: ['rgba(99, 102, 241, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(6, 182, 212, 0.8)', 'rgba(16, 185, 129, 0.8)']
        }
      ]
    };

    // Doughnut Chart - Status Breakdown
    this.doughnutChartData = {
      labels: ['Completed', 'In Progress', 'Pending', 'Delayed', 'Extended'],
      datasets: [
        {
          data: [
            data.completedTask ?? 0,
            data.activeTask ?? 0,
            data.pendingTask ?? 0,
            data.delayedTask ?? 0,
            data.extendedTask ?? 0
          ],
          backgroundColor: [
            '#10b981',
            '#6366f1',
            '#f59e0b',
            '#ef4444',
            '#8b5cf6'
          ],
          borderColor: 'rgba(255, 255, 255, 0.9)',
          borderWidth: 2,
          hoverBorderColor: 'rgba(255, 255, 255, 1)',
          hoverBorderWidth: 3
        }
      ]
    };

    // Polar Chart - Performance Metrics
    this.polarChartData = {
      labels: ['Productivity', 'Quality', 'Efficiency', 'Timeliness', 'Collaboration', 'Innovation'],
      datasets: [
        {
          label: 'Current Performance',
          data: [78, 82, 75, 88, 80, 72],
          backgroundColor: [
            'rgba(99, 102, 241, 0.3)',
            'rgba(139, 92, 246, 0.3)',
            'rgba(236, 72, 153, 0.3)',
            'rgba(16, 185, 129, 0.3)',
            'rgba(6, 182, 212, 0.3)',
            'rgba(245, 158, 11, 0.3)'
          ],
          borderColor: [
            '#6366f1',
            '#8b5cf6',
            '#ec4899',
            '#10b981',
            '#06b6d4',
            '#f59e0b'
          ],
          borderWidth: 2
        }
      ]
    };

    // Mixed Chart - Growth Metrics
    this.mixedChartData = {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
      datasets: [
        {
          label: 'User Growth',
          data: [5, 12, 8, 15, 22],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5
        },
        {
          label: 'Task Growth',
          data: [20, 28, 32, 40, 48],
          borderColor: '#ec4899',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ec4899',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5
        },
        {
          label: 'Completion Rate',
          data: [65, 70, 75, 80, 85],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5
        }
      ]
    };
  }
}