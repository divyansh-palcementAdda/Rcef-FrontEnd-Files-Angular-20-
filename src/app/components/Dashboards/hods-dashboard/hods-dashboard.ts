import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { Subscription } from 'rxjs';
import { DashboardDto } from '../../../Model/DashboardDto';
import { ApiService } from '../../../Services/api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { CommonModule, DatePipe } from '@angular/common';
import { trigger, transition, useAnimation ,query, stagger} from '@angular/animations';
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
}  ];

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
    this.authService.logout();
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
    // ── Core Totals (Dark) ────────────────────────
    { title: 'Total Tasks',        value: d.totalTask,        color: c('dark'),     icon: 'bi-clipboard-list',    route: '/view-tasks',                     delta: 5 },
    { title: 'Total Users',       value: d.activeUsers,      color: c('info'),     icon: 'bi-person-check-fill', route: '/viewAllUsers', queryParams: { status: 'ACTIVE' }, delta: 6 },

    // ── Task Flow ─────────────────────────────────
    { title: 'Active Tasks',       value: d.activeTask,       color: c('primary'),  icon: 'bi-play-circle',       route: '/view-tasks',   queryParams: { status: 'IN_PROGRESS' }, delta: 7 },
    { title: 'Pending Tasks',      value: d.pendingTask,      color: c('warning'),  icon: 'bi-hourglass-split',   route: '/view-tasks',   queryParams: { status: 'PENDING' },        delta: -1 },
    { title: 'Upcoming Tasks',     value: d.upcomingTask,     color: c('info'),     icon: 'bi-calendar3',         route: '/view-tasks',   queryParams: { status: 'Upcoming' },      delta: 4 },
    { title: 'Completed Tasks',    value: d.completedTask,    color: c('success'),  icon: 'bi-check2-circle',     route: '/view-tasks',   queryParams: { status: 'CLOSED' },        delta: 8 },

    // ── Issues & Extensions ───────────────────────
    { title: 'Delayed Tasks',      value: d.delayedTask,      color: c('danger'),   icon: 'bi-exclamation-triangle-fill', route: '/view-tasks', queryParams: { status: 'Delayed' },   delta: 3 },
    { title: 'Extended Tasks',     value: d.extendedTask,     color: c('warning'),  icon: 'bi-arrow-repeat',      route: '/view-tasks',   queryParams: { status: 'Extended' },      delta: 2 },

    // ── Requests ──────────────────────────────────
    { title: 'Extension Requests', value: d.requestForExtension, color: c('secondary'), icon: 'bi-clock-history',  route: '/view-tasks', queryParams: { status: 'REQUEST_FOR_EXTENSION' }, delta: 1 },
    { title: 'Closure Requests',   value: d.requestForClosure,   color: c('secondary'), icon: 'bi-lock-fill',      route: '/view-tasks', queryParams: { status: 'REQUEST_FOR_CLOSURE' },   delta: -2 },

   ];
}
  /** ✅ Navigate to a Route */
  goToTaskPage(card: any): void {
    this.router.navigate([card.route], { queryParams: card.queryParams || {} });
  }

  /** ✅ Update Chart Data Dynamically */
  private updateCharts(data: DashboardDto): void {
    this.pieChartData = {
      labels: ['Pending', 'Completed', 'Delayed', 'Extended', 'Upcomming'],
      datasets: [
        {
          data: [
            data.pendingTask ?? 0,
            data.completedTask ?? 0,
            data.delayedTask ?? 0,
            data.extendedTask ?? 0,
            data.upcomingTask ?? 0
          ],
          backgroundColor: ['#fbbf24', '#10b981', '#ef4444', '#8b5cf6', '#f7ff04ff']
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