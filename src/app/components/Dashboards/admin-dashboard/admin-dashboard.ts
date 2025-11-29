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
      { title: 'Total Tasks', value: d.totalTask, color: c('dark'), icon: 'bi-clipboard-list', route: '/view-tasks', delta: 5 },
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
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Task Completion',
          data: [12, 19, 15, 25, 22, 30],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'User Activity',
          data: [8, 12, 18, 14, 20, 25],
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
}