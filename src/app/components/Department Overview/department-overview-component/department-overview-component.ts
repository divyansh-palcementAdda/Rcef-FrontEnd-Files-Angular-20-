import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { DashboardDto } from '../../../Model/DashboardDto';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-department-overview-component',
  imports: [CommonModule],
  templateUrl: './department-overview-component.html',
  styleUrl: './department-overview-component.css',
})
export class DepartmentOverviewComponent implements OnInit {
  private dataSub?: Subscription;
  dashboardData?: DashboardDto;

  constructor(
    public router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.dataSub = this.apiService.getDashboardData().subscribe({
      next: (data) => {
        if (data) {
          this.dashboardData = data;
          console.log('Dashboard data received:', data);
        }
      },
      error: (err) => console.error('Error fetching dashboard data:', err)
    });
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
  }

  statCards(d: DashboardDto) {
    const c = (color: string) => color;

    const cards = [
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
        title: 'Total Sub-Departments',
        value: d.activeSubDepartments,
        color: c('dark'),
        icon: 'bi-building',
        route: '/departments',
        delta: d.activeSubDepartments ?? 0
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
        title: 'New Tasks Requiring Approval',
        value: d.tasksRequireApproval,
        color: c('warning'),
        icon: 'bi-bell',
        route: '/view-tasks',
        queryParams: { status: 'Approval' },
        delta: d.tasksRequireApproval ?? 0
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
        queryParams: { status: 'MY_DEPARTMENT' },
        delta: d.myDepartmentTasks ?? 0
      }

    ];

    return cards;
  }

  goToTaskPage(card: any): void {
    this.router.navigate([card.route], { queryParams: card.queryParams || {} });
  }

  getCardBackgroundColor(color: string): string {
    const colorMap: { [key: string]: string } = {
      'primary': '#e8f0fe',
      'success': '#e6f9f0',
      'danger': '#fee2e2',
      'warning': '#fef3c7',
      'info': '#e0f2fe',
      'secondary': '#f3f4f6',
      'dark': '#f3f4f6'
    };
    return colorMap[color] || '#f3f4f6';
  }

  getCardIconColor(color: string): string {
    const colorMap: { [key: string]: string } = {
      'primary': '#3d6fd4',
      'success': '#1db06a',
      'danger': '#dc2626',
      'warning': '#d97706',
      'info': '#0284c7',
      'secondary': '#6b7280',
      'dark': '#374151'
    };
    return colorMap[color] || '#374151';
  }
}
