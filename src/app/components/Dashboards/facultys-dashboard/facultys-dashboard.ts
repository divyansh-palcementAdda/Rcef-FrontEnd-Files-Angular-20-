import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { Subscription } from 'rxjs';
import { trigger, transition, useAnimation, query, stagger } from '@angular/animations';
import { BaseChartDirective } from 'ng2-charts';

import { ApiService } from '../../../Services/api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { DashboardDto } from '../../../Model/DashboardDto';
import { fadeInUp } from '../../../Animations/fade-in-up.animation';

@Component({
  selector: 'app-facultys-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    BaseChartDirective,
    DatePipe
  ],
  animations: [
    trigger('fadeInUpStagger', [
      transition(':enter', [
        query(':enter', [
          stagger(80, [
            useAnimation(fadeInUp, {
              params: { time: '300ms' }
            })
          ])
        ], { optional: true })
      ])
    ])
  ],
  templateUrl: './facultys-dashboard.html',
  styleUrls: ['./facultys-dashboard.css']
})
export class FacultysDashboard implements OnInit, OnDestroy {
  private dataSub?: Subscription;
  dashboardData?: DashboardDto;
  
  // Chart data
  pieChartData!: ChartConfiguration<'pie'>['data'];
  barChartData!: ChartConfiguration<'bar'>['data'];
  
  // Chart options
  pieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          font: {
            family: "'Inter', sans-serif",
            size: 11
          }
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563'
      }
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart' as const
    }
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(99, 102, 241, 0.08)' },
        ticks: { color: '#6b7280' }
      },
      x: {
        grid: { color: 'rgba(99, 102, 241, 0.05)' },
        ticks: { color: '#6b7280' }
      }
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart' as const
    }
  };

  // Sidebar navigation for faculty
  sidebarLinks = [
    {
      label: 'Dashboard',
      route: '/teacher',
      icon: 'bi-speedometer2',
      color: 'primary'
    },
    {
      label: 'My Tasks',
      route: '/view-tasks',
      queryParams: { view: 'Self' },
      icon: 'bi-list-task',
      color: 'success',
      tooltip: 'View all your assigned tasks'
    },
    // {
    //   label: 'My Department',
    //   route: '/departments',
    //   icon: 'bi-building',
    //   color: 'info',
    //   tooltip: 'View department details and members'
    // },
    {
      label: 'Task Requests',
      route: '/task-requests',
      icon: 'bi-clock-history',
      color: 'warning',
      tooltip: 'View and manage your task requests'
    },
  ];

  currentDate = new Date();

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthApiService,
    private jwtService: JwtService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
  }

  loadDashboardData(): void {
    this.dataSub = this.apiService.getDashboardData().subscribe({
      next: (data) => {
        if (data) {
          this.dashboardData = data;
          console.log('Faculty Dashboard data loaded:', this.dashboardData);
          this.updateCharts(data);
        }
      },
      error: (err) => console.error('Error fetching dashboard data:', err)
    });
  }

  logout(): void {
    const refreshToken = this.authService.getRefreshToken() ?? undefined;
    this.authService.logout(refreshToken).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  getGreetingTime(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  calculatePerformance(): number {
    if (!this.dashboardData) return 0;
    
    const completed = this.dashboardData.completedTask || 0;
    const total = this.dashboardData.totalTask || 0;
    const delayed = this.dashboardData.delayedTask || 0;
    
    if (total === 0) return 0;
    
    let performance = Math.round((completed / total) * 100);
    
    // Add bonus for on-time completion
    const penalty = Math.min(delayed * 5, 30);
    performance = Math.max(0, Math.min(100, performance - penalty));
    
    // Bonus for having self-assigned tasks
    const selfTasks = this.dashboardData.selfTask || 0;
    if (selfTasks > 0) {
      performance = Math.min(100, performance + (selfTasks * 2));
    }
    
    return performance;
  }

  statCards(d: DashboardDto): any[] {
    return [
      // Core Metrics
      {
        title: 'Total Tasks',
        value: d.totalTask || 0,
        color: 'secondary',
        icon: 'bi-clipboard-check',
        route: '/view-tasks',
        delta: d.totalTask > 0 ? 5 : 0,
        description: 'All assigned tasks'
      },
      {
        title: 'Active Tasks',
        value: d.activeTask || 0,
        color: 'primary',
        icon: 'bi-play-circle',
        route: '/view-tasks',
        queryParams: { status: 'IN_PROGRESS' },
        delta: (d.activeTask ?? 0) > 0 ? 3 : 0,
        description: 'Tasks in progress'
      },
      {
        title: 'Pending Tasks',
        value: d.pendingTask || 0,
        color: 'warning',
        icon: 'bi-hourglass-split',
        route: '/view-tasks',
        queryParams: { status: 'PENDING' },
        delta: d.pendingTask > 0 ? -2 : 0,
        badge: d.pendingTask > 0 ? 'attention' : undefined,
        description: 'Awaiting action'
      },
      {
        title: 'Completed Tasks',
        value: d.completedTask || 0,
        color: 'success',
        icon: 'bi-check2-circle',
        route: '/view-tasks',
        queryParams: { status: 'CLOSED' },
        delta: d.completedTask > 0 ? 8 : 0,
        description: 'Successfully completed'
      },
      
      // Self Management
      {
        title: 'Extended Tasks',
        value: d.extendedTask || 0,
        color: 'info',
        icon: 'bi-person-badge',
        route: '/view-tasks',
        queryParams: { status: 'EXTENDED' },
        delta: (d.selfTask ?? 0) > 0 ? 4 : 0,
        description: 'Extended Tasks'
      },
      {
        title: 'Delayed Tasks',
        value: d.delayedTask || 0,
        color: 'danger',
        icon: 'bi-exclamation-triangle',
        route: '/view-tasks',
        queryParams: { status: 'DELAYED' },
        delta: d.delayedTask > 0 ? -5 : 0,
        badge: d.delayedTask > 0 ? 'urgent' : undefined,
        description: 'Require immediate attention'
      },
      
      // Request Management
      {
        title: 'Extension Requests',
        value: d.requestForExtension || 0,
        color: 'secondary',
        icon: 'bi-clock',
        route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_EXTENSION' },
        delta: d.requestForExtension > 0 ? 2 : 0,
        description: 'Pending extensions'
      },
      {
        title: 'Closure Requests',
        value: d.requestForClosure || 0,
        color: 'secondary',
        icon: 'bi-lock',
         route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_CLOSURE' },
        delta: d.requestForClosure > 0 ? 1 : 0,
        description: 'Awaiting closure'
      },
      
      // Performance
      {
        title: 'Upcoming Tasks',
        value: d.upcomingTask || 0,
        color: 'info',
        icon: 'bi-calendar3',
        route: '/view-tasks',
        queryParams: { status: 'UPCOMING' },
        delta: d.upcomingTask > 0 ? 4 : 0,
        description: 'Tasks starting soon'
      },

     {
  title: 'Pending Requests',
  value: d.pendingRequests ?? 0,
  color: 'primary',
  icon: 'bi-hourglass-split',
  route: '/task-requests',
  queryParams: { status: 'PENDING' },
  delta: d.pendingRequests > 0 ? 1 : 0,
  description: 'Requests awaiting review'
},
      {
        title: 'Approved Requests',
        value: d.approvedRequests || 0,
        color: 'success',
        icon: 'bi-check-circle',
        route: '/task-requests',
        queryParams: { status: 'APPROVED' },
        delta: d.approvedRequests > 0 ? 2 : 0,
        description: 'Requests approved'
      },
      {
        title: 'Rejected Requests',
        value: d.rejectedRequests || 0,
        color: 'danger',
        icon: 'bi-x-circle',
        route: '/task-requests',
        queryParams: { status: 'REJECTED' },
        delta: d.rejectedRequests > 0 ? -1 : 0,
        description: 'Requests rejected'
      }
    ];
  }

  goToPage(card: any): void {
    if (card.route) {
      this.router.navigate([card.route], { queryParams: card.queryParams || {} });
    }
  }

  private updateCharts(data: DashboardDto): void {
    // Pie Chart - Task Distribution
    this.pieChartData = {
      labels: ['Active', 'Pending', 'Completed', 'Delayed', 'Self-Assigned', 'Upcoming'],
      datasets: [{
        data: [
          data.activeTask || 0,
          data.pendingTask || 0,
          data.completedTask || 0,
          data.delayedTask || 0,
          data.selfTask || 0,
          data.upcomingTask || 0
        ],
        backgroundColor: [
          '#6366f1', // Primary
          '#f59e0b', // Warning
          '#10b981', // Success
          '#ef4444', // Danger
          '#3b82f6', // Blue
          '#06b6d4'  // Cyan
        ],
        borderColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 10,
        borderRadius: 6
      }]
    };

    // Bar Chart - Task Overview
    this.barChartData = {
      labels: ['Total Tasks', 'Active', 'Completed', 'Self-Assigned'],
      datasets: [{
        label: 'Task Count',
        data: [
          data.totalTask || 0,
          data.activeTask || 0,
          data.completedTask || 0,
          data.selfTask || 0
        ],
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(139, 92, 246, 0.8)'
        ],
        borderColor: [
          '#6366f1',
          '#3b82f6',
          '#10b981',
          '#8b5cf6'
        ],
        borderWidth: 1,
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.6
      }]
    };
  }

  getBadgeClass(badgeType: string): string {
    switch (badgeType) {
      case 'urgent': return 'badge-urgent';
      case 'attention': return 'badge-attention';
      case 'new': return 'badge-new';
      default: return 'badge-default';
    }
  }

  getPerformanceStatus(): string {
    const performance = this.calculatePerformance();
    if (performance >= 80) return 'Excellent';
    if (performance >= 60) return 'Good';
    if (performance >= 40) return 'Average';
    return 'Needs Improvement';
  }

  getPerformanceColor(): string {
    const performance = this.calculatePerformance();
    if (performance >= 80) return 'success';
    if (performance >= 60) return 'primary';
    if (performance >= 40) return 'warning';
    return 'danger';
  }
}