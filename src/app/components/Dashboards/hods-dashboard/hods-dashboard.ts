import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { Subscription } from 'rxjs';
import { DashboardDto } from '../../../Model/DashboardDto';
import { ApiService } from '../../../Services/api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { CommonModule, DatePipe } from '@angular/common';
import { trigger, transition, useAnimation, query, stagger } from '@angular/animations';
import { BaseChartDirective } from 'ng2-charts';
import { fadeInUp } from '../../../Animations/fade-in-up.animation';
import { BulletinBannerComponent } from '../../Shared/bulletin-banner/bulletin-banner';

@Component({
  selector: 'app-hods-dashboard',
  imports: [CommonModule, RouterLink, BaseChartDirective, DatePipe, RouterLinkActive, BulletinBannerComponent,],
  animations: [
    trigger('fadeInUpStagger', [
      transition(':enter', [
        query(':enter', [
          stagger(80, [
            useAnimation(fadeInUp, {
              params: { time: '300ms ease-out' } // Valid timing
            })
          ])
        ], { optional: true })
      ])
    ])
  ],
  templateUrl: './hods-dashboard.html',
  styleUrl: './hods-dashboard.css'
})
export class HodsDashboard {
  private dataSub?: Subscription;
  dashboardData?: DashboardDto;

  pieChartData!: ChartConfiguration<'pie'>['data'];
  barChartData!: ChartConfiguration<'bar'>['data'];

  pieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 20 } },
      tooltip: { enabled: true }
    },
    animation: { duration: 2000, easing: 'easeInOutQuart' as const }
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { y: { beginAtZero: true } },
    animation: { duration: 2000, easing: 'easeInOutQuart' as const }
  };

  currentDate = new Date();

  sidebarLinks = [
    { label: 'Dashboard', click: () => this.dashboard(), icon: 'bi-speedometer2', color: 'primary' },
    { label: 'My Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-list-check', color: 'success' },
    { label: 'Add Task', route: '/add-task', icon: 'bi-plus-circle', color: 'success' },
    {
      label: 'My Self-Assigned Tasks',
      route: '/view-tasks',
      queryParams: { status: 'selfAssigned' },     // lowercase, matches backend logic
      icon: 'bi bi-person-check-fill',    // better icon: person with check
      color: 'success',
      tooltip: 'View tasks you created and assigned to yourself'
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
          console.log(this.dashboardData)
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
  const refreshToken = this.authService.getRefreshToken() ?? undefined; // normalize null to undefined
  this.authService.logout(refreshToken).subscribe({
    next: () => this.router.navigate(['/login']),
    error: () => this.router.navigate(['/login']) // still redirect
  });
}

  /** ✅ Dashboard Navigation with Token Validation */
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

  /** ✅ Stat Cards Builder */
  statCards(d: DashboardDto) {
    const c = (color: string) => color; // shorthand

    return [
      // ── Core Totals (Bold & Prominent) ─────────────────────
      {
        title: 'Total Tasks',
        value: d.totalTask,
        color: c('dark'),
        icon: 'bi-clipboard-list',
        route: '/view-tasks',
        delta: 5
      },
      {
        title: 'Active Users',
        value: d.activeUsers,
        color: c('teal'),
        icon: 'bi-person-check-fill',
        route: '/viewAllUsers',
        queryParams: { status: 'ACTIVE' },
        delta: 6
      },

      // ── Task Status Flow ───────────────────────────────────
      {
        title: 'In Progress',
        value: d.activeTask,
        color: c('primary'),
        icon: 'bi-play-circle-fill',
        route: '/view-tasks',
        queryParams: { status: 'IN_PROGRESS' },
        badge: 'live'
      },
      {
        title: 'Pending Tasks',
        value: d.pendingTask,
        color: c('warning'),
        icon: 'bi-hourglass-split',
        route: '/view-tasks',
        queryParams: { status: 'PENDING' },
        delta: -2
      },
      {
        title: 'Upcoming Tasks',
        value: d.upcomingTask,
        color: c('info'),
        icon: 'bi-calendar3-event',
        route: '/view-tasks',
        queryParams: { status: 'UPCOMING' },
        delta: 4
      },
      {
        title: 'Completed Tasks',
        value: d.completedTask,
        color: c('success'),
        icon: 'bi-check2-square',
        route: '/view-tasks',
        queryParams: { status: 'CLOSED' },
        delta: 8
      },

      // ── Critical Alerts ────────────────────────────────────
      {
        title: 'Delayed Tasks',
        value: d.delayedTask,
        color: c('danger'),
        icon: 'bi-exclamation-triangle-fill',
        route: '/view-tasks',
        queryParams: { status: 'DELAYED' },
        badge: 'urgent',
        delta: 3
      },

      // ── Action Requests (Task Level) ───────────────────────
      {
        title: 'Extension Requests',
        value: d.requestForExtension,
        color: c('orange'),
        icon: 'bi-clock-history',
        route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_EXTENSION' },
        badge: 'review'
      },
      {
        title: 'Closure Requests',
        value: d.requestForClosure,
        color: c('pink'),
        icon: 'bi-lock-fill',
        route: '/view-tasks',
        queryParams: { status: 'REQUEST_FOR_CLOSURE' },
        badge: 'review'
      },

      // ── Request Approval Status (TaskRequest Entity) ───────
      {
        title: 'Pending Requests',
        value: d.pendingRequests,
        color: c('secondary'),
        icon: 'bi-hourglass-bottom',
        route: '/task-requests',
        queryParams: { status: 'PENDING' },
        badge: 'action-required',
        delta: -1
      },
      {
        title: 'Approved Requests',
        value: d.approvedRequests,
        color: c('success'),
        icon: 'bi-check-circle-fill',
        route: '/task-requests',
        queryParams: { status: 'APPROVED' }
      },
      {
        title: 'Rejected Requests',
        value: d.rejectedRequests,
        color: c('danger'),
        icon: 'bi-x-circle-fill',
        route: '/task-requests',
        queryParams: { status: 'REJECTED' }
      },
    ];
  }
  /** ✅ Navigate to a Route */
  goToTaskPage(card: any): void {
    this.router.navigate([card.route], { queryParams: card.queryParams || {} });
  }

  /** ✅ Update Chart Data Dynamically */
  private updateCharts(data: DashboardDto): void {
    this.pieChartData = {
      labels: ['Pending', 'Completed', 'Delayed', 'Extended', 'Upcomming','Active'],
      datasets: [
        {
          data: [
            data.pendingTask ?? 0,
            data.completedTask ?? 0,
            data.delayedTask ?? 0,
            data.extendedTask ?? 0,
            data.upcomingTask ?? 0,
            data.activeTask ?? 0
          ],
          backgroundColor: ['#fbbf24', '#10b981', '#ef4444', '#8b5cf6', '#f7ff04ff', '#3b82f6'
          ]
        }
      ]
    };

    this.barChartData = {
      labels: ['Total Users', 'Total Tasks', 'Upcoming Tasks'],
      datasets: [
        {
          label: 'Count',
          data: [
            data.totalUsers ?? 0,
            data.totalTask ?? 0,
            data.upcomingTask ?? 0
          ],
          backgroundColor: ['#3b82f6', '#6366f1', '#06b6d4']
        }
      ]
    };
  }
}