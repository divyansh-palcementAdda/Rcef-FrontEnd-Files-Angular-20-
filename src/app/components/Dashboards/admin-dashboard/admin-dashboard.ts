import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { ApiService } from '../../../Services/api-service';
import { DashboardDto } from '../../../Model/DashboardDto';
import { trigger, transition, useAnimation } from '@angular/animations';
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
  imports: [CommonModule, RouterLink, BaseChartDirective, DatePipe,RouterLinkActive,BulletinBannerComponent],
  animations: [
    trigger('fadeInUpStagger', [
      transition(':enter', useAnimation(fadeInUp, { params: { time: '600ms' } }))
    ])
  ]
})
export class AdminDashboard implements OnInit, OnDestroy {

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
    { label: 'Self Task', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-list-check', color: 'success' },
    { label: 'Add Task', route: '/add-task', icon: 'bi-plus-circle', color: 'success' },
    { label: 'Add User', route: '/add-user', icon: 'bi-person-plus', color: 'info' },
    { label: 'Add Department', route: '/add-department', icon: 'bi-building-gear', color: 'warning' },
    { label: 'Bulletin Alerts', route: '/bulletin-alerts', icon: 'bi-bell', color: 'danger' }
  ];

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthApiService,
    private jwtService: JwtService
  ) {}

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
    const token = localStorage.getItem('token');
    if (token && this.jwtService.isTokenValid(token)) {
      const userId = this.jwtService.getUserIdFromToken(token);
      if (userId) {
        this.authService.dashboard({ userId });
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
    return [
      { title: 'Total Tasks', value: d.totalTask, color: 'primary', icon: 'bi-clipboard-list', route: '/view-tasks', delta: 5 },
      { title: 'Total Users', value: d.totalUsers, color: 'success', icon: 'bi-people', route: '/viewAllUsers', delta: 2 },
      { title: 'Pending Tasks', value: d.pendingTask, color: 'warning', icon: 'bi-hourglass', route: '/view-tasks', queryParams: { status: 'PENDING' }, delta: -1 },
      { title: 'Delayed Tasks', value: d.delayedTask, color: 'danger', icon: 'bi-exclamation-octagon', route: '/view-tasks', queryParams: { status: 'Delayed' }, delta: 3 },
      { title: 'Completed Tasks', value: d.completedTask, color: 'success', icon: 'bi-check-lg', route: '/view-tasks', queryParams: { status: 'CLOSED' }, delta: 8 },
      { title: 'Upcoming Tasks', value: d.upcomingTask, color: 'info', icon: 'bi-calendar3-week', route: '/view-tasks', queryParams: { status: 'Upcoming' }, delta: 4 },
      { title: 'Extension Requests', value: d.requestForExtension, color: 'warning', icon: 'bi-arrow-clockwise',route: '/view-tasks', queryParams: { status: 'REQUEST_FOR_EXTENSION' }, delta: 1 },
      { title: 'Active Users', value: d.activeUsers, color: 'info', icon: 'bi-person-badge', route: '/viewAllUsers', queryParams: { status: 'ACTIVE' }, delta: 6 },
      { title: 'Total Departments', value: d.totalDepartments, color: 'dark', icon: 'bi-building', route: '/departments', delta: 0 },
      { title: 'Closure Requests', value: d.requestForClosure, color: 'secondary', icon: 'bi-lock-fill',route: '/view-tasks', queryParams: { status: 'REQUEST_FOR_CLOSURE' }, delta: -2 },
      { title: 'My Tasks', value: d.selfTask, color: 'primary', icon: 'bi-person-check', route: '/view-tasks', queryParams: { status: 'Self' }, delta: 7 },
      { title: 'Extended Tasks', value: d.extendedTask, color: 'warning', icon: 'bi-arrow-repeat', route: '/view-tasks', queryParams: { status: 'Extended' }, delta: 2 }
    ];
  }
  dashboardStats = {
  delayedTasks: 5,
  departmentsPending: [
    { departmentName: 'HR', pendingTasks: 3 },
    { departmentName: 'IT', pendingTasks: 4 },
    { departmentName: 'Finance', pendingTasks: 2 }
  ]
};

  /** ✅ Navigate to a Route */
  goToTaskPage(card: any): void {
    console.log('Navigating to:', card.route, 'with params:', card.queryParams);
    this.router.navigate([card.route], { queryParams: card.queryParams || {} });
  }

  /** ✅ Update Chart Data Dynamically */
  private updateCharts(data: DashboardDto): void {
    this.pieChartData = {
      labels: ['Pending', 'Completed', 'Delayed', 'Extended','Upcomming'],
      datasets: [
        {
          data: [
            data.pendingTask ?? 0,
            data.completedTask ?? 0,
            data.delayedTask ?? 0,
            data.extendedTask ?? 0,
            data.upcomingTask??0
          ],
          backgroundColor: ['#fbbf24', '#10b981', '#ef4444', '#8b5cf6','#f7ff04ff']
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
