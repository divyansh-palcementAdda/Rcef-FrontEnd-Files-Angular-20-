import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { JsonPipe, NgIf, NgFor } from '@angular/common';
import axios from 'axios';
import { Navbar } from './components/Shared/navbar/navbar';
import { Footer } from './components/Shared/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ RouterOutlet,Navbar,Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App  {
  protected readonly title = signal('AreYouReporting');
  // protected dashboardData: any = {};
  // protected isLoading = signal(true);
  // protected sidebarLinks = [
  //   { label: 'Dashboard', icon: 'bi-speedometer2', color: 'primary' },
  //   { label: 'Users', icon: 'bi-people', color: 'primary' },
  //   { label: 'Reports', icon: 'bi-graph-up', color: 'primary' },
  //   { label: 'Settings', icon: 'bi-gear', color: 'primary' }
  // ];

  // ngOnInit() {
  //   this.fetchDashboardData();
  // }

  // async fetchDashboardData() {
  //   try {
  //     this.isLoading.set(true);
  //     const response = await axios.get('http://localhost:8080/api/dashboard', {
  //       headers: {
  //         Authorization: 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJyb2xlIjoiQURNSU4iLCJ1c2VySWQiOjEsInN1YiI6IkRpdnlhbnNoIiwiaWF0IjoxNzU5MTQ0MTIxLCJleHAiOjE3NTkxNDQ5ODV9.wVbRDeuKA1lGr0cPuEsJK0VeD3bLswIGFb--Ry2RAmV5pM_qsYqZYj8BMPhL00SKLolrPPOyLigcw7oqb4xFaw'
  //       }
  //     });
  //     this.dashboardData = response.data;
  //     this.isLoading.set(false);
  //   } catch (error) {
  //     console.error('Error fetching dashboard data:', error);
  //     this.dashboardData = { error: 'Failed to fetch dashboard data' };
  //     this.isLoading.set(false);
  //   }
  // }

  // statCards(data: any) {
  //   return [
  //     { 
  //       title: 'Total Users', 
  //       value: data.totalUsers || 0, 
  //       icon: 'bi-people-fill', 
  //       color: 'primary' 
  //     },
  //     { 
  //       title: 'Active Projects', 
  //       value: data.activeProjects || 0, 
  //       icon: 'bi-folder-fill', 
  //       color: 'primary' 
  //     },
  //     { 
  //       title: 'Pending Tasks', 
  //       value: data.pendingTasks || 0, 
  //       icon: 'bi-list-check', 
  //       color: 'primary' 
  //     },
  //     { 
  //       title: 'Total Revenue', 
  //       value: data.totalRevenue ? '$' + data.totalRevenue : '$0', 
  //       icon: 'bi-currency-dollar', 
  //       color: 'primary' 
  //     }
  //   ];
  // }
}
