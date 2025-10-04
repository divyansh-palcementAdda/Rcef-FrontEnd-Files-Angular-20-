// src/app/Components/admin-dashboard/admin-dashboard.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { DashboardService } from '../../../Services/dashboard-service';
import { Observable, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';

import { Chart, registerables } from 'chart.js';
import { Navbar } from "../../Shared/navbar/navbar";
import { routes } from '../../../app.routes';
import { ApiService } from '../../../Services/api-service';
import { DashboardDto } from '../../../Model/DashboardDto';
Chart.register(...registerables);  

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.html',
  imports: [CommonModule, RouterLink, BaseChartDirective],
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboard implements OnInit, OnDestroy {
  // username: string | undefined;
  dashboardData : DashboardDto | undefined;
  private dataSub!: Subscription;
  private apiService = inject(ApiService);

  pieChartData: any;
  barChartData: any;

  pieChartType = 'pie';
  barChartType = 'bar';

  pieChartOptions = { responsive: true, maintainAspectRatio: false };
  barChartOptions = { responsive: true, maintainAspectRatio: false };

  // isRefreshing = false;  // 🔄 Button loader flag

   sidebarLinks = [
    { label: 'Dashboard', route: '/dashboard', icon: 'bi-speedometer2', color: 'primary' },
    { label: 'Self Task', route: '/self-task', icon: 'bi-list-check', color: 'success' },
    { label: 'Add Task', route: '/add-task', icon: 'bi-list-task', color: 'success' },
    { label: 'Add User', route: '/add-user', icon: 'bi-people-add', color: 'success' },
    { label: 'Add Department', route: '/add-department', icon: 'bi-building-add', color: 'success' },
    { label: 'Bulletin Alerts', route: '/bulletin-alerts', icon: 'bi-bell-fill', color: 'danger' },
    { label: 'Analytics', route: '/analytics', icon: 'bi-bar-chart-line-fill', color: 'warning' }
  ];

  statCards(dashboardData: any) {
    return [
      { title: 'Total Tasks', value: dashboardData.totalTask, color: 'primary', icon: 'bi-list-task' },
      { title: 'Total Users', value: dashboardData.totalUsers, color: 'success', icon: 'bi-people-fill' },
      { title: 'Pending Tasks', value: dashboardData.pendingTask, color: 'warning', icon: 'bi-hourglass-split' },
      { title: 'Delayed Tasks', value: dashboardData.delayedTask, color: 'danger', icon: 'bi-exclamation-triangle-fill' },
      { title: 'Completed Tasks', value: dashboardData.completedTask, color: 'success', icon: 'bi-check-circle-fill' },
      { title: 'Upcoming Tasks', value: dashboardData.upcomingTask, color: 'info', icon: 'bi-calendar-event' },
      { title: 'Request for Extension', value: dashboardData.requestForExtension, color: 'warning', icon: 'bi-clock-history' },
      { title: 'Active Users', value: dashboardData.activeUsers, color: 'info', icon: 'bi-person-check-fill', route: '/viewAllUsers' },
      { title: 'Total Departments', value: dashboardData.totalDepartments, color: 'secondary', icon: 'bi-building' },
      { title: 'Request for Closure', value: dashboardData.requestForClosure, color: 'secondary', icon: 'bi-check-square-fill' },
      { title: 'My Tasks', value: dashboardData.myTasks, color: 'secondary', icon: 'bi-check-square-fill' }

    ];
  }

  // constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    
    this.dataSub = this.apiService.getDashboardData().subscribe(data => {
      if (data) {
        // this.username= data.userName  ;  // Set username
        this.dashboardData=data
        console.log('📊 Dashboard data updated:', data);
        this.updateCharts(data);
      }
    });

  }


  private updateCharts(data: any): void {
    // 🥧 Pie Chart — Task Distribution
    this.pieChartData = {
      labels: ['Pending', 'Completed', 'Delayed'],
      datasets: [
        {
          data: [data.pendingTask, data.completedTask, data.delayedTask],
          backgroundColor: ['#fbbf24', '#10b981', '#ef4444']
        }
      ]
    };

    // 📊 Bar Chart — System Stats
    this.barChartData = {
      labels: ['Total Users', 'Total Tasks', 'Upcoming Tasks'],
      datasets: [
        {
          label: 'Count',
          data: [data.totalUsers, data.totalTask, data.upcomingTask],
          backgroundColor: ['#3b82f6', '#6366f1', '#06b6d4']
        }
      ]
    };
  }

  ngOnDestroy(): void {
    if (this.dataSub) {
      this.dataSub.unsubscribe();
    }
  }
}
