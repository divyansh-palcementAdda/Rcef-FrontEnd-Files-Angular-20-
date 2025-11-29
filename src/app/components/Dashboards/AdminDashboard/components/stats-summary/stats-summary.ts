import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';
import { PercentageBadgeComponent } from '../../shared/percentage-badge/percentage-badge';

export interface StatCard {
  title: string;
  value: number;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  route: string;
  queryParams?: any;
  delta: number;
  description: string;
}

@Component({
  selector: 'app-stats-summary',
  standalone: true,
  imports: [CommonModule, GradientCardComponent, PercentageBadgeComponent],
  templateUrl: './stats-summary.html',
  styleUrls: ['./stats-summary.css']
})
export class StatsSummaryComponent {
  @Input() dashboardData: any = null;
  @Output() cardClick = new EventEmitter<{ route: string; queryParams?: any }>();

  get statCards(): StatCard[] {
    if (!this.dashboardData) {
      // Sample data for demonstration
      return [
        {
          title: 'Total Users',
          value: 1247,
          color: 'primary',
          icon: 'bi-people',
          route: '/viewAllUsers',
          delta: 12,
          description: 'Registered users'
        },
        {
          title: 'Total Tasks',
          value: 543,
          color: 'success',
          icon: 'bi-clipboard-check',
          route: '/view-tasks',
          delta: 8,
          description: 'Active tasks'
        },
        {
          title: 'Pending Requests',
          value: 23,
          color: 'warning',
          icon: 'bi-clock',
          route: '/view-tasks',
          queryParams: { status: 'PENDING' },
          delta: -3,
          description: 'Awaiting approval'
        },
        {
          title: 'Completion Rate',
          value: 87,
          color: 'info',
          icon: 'bi-graph-up',
          route: '/analytics',
          delta: 5,
          description: 'Overall performance'
        }
      ];
    }

    return [
      {
        title: 'Total Users',
        value: this.dashboardData.totalUsers || 0,
        color: 'primary',
        icon: 'bi-people',
        route: '/viewAllUsers',
        delta: 12,
        description: 'Registered users'
      },
      {
        title: 'Total Tasks',
        value: this.dashboardData.totalTask || 0,
        color: 'success',
        icon: 'bi-clipboard-check',
        route: '/view-tasks',
        delta: 8,
        description: 'Active tasks'
      },
      {
        title: 'Pending Requests',
        value: this.dashboardData.pendingTask || 0,
        color: 'warning',
        icon: 'bi-clock',
        route: '/view-tasks',
        queryParams: { status: 'PENDING' },
        delta: -3,
        description: 'Awaiting approval'
      },
      {
        title: 'Completion Rate',
        value: this.dashboardData.completedTask || 0,
        color: 'info',
        icon: 'bi-graph-up',
        route: '/analytics',
        delta: 5,
        description: 'Overall performance'
      }
    ];
  }

  onCardClick(card: StatCard): void {
    this.cardClick.emit({
      route: card.route,
      queryParams: card.queryParams
    });
  }

  getDeltaVariant(delta: number): 'positive' | 'negative' | 'neutral' {
    return delta >= 0 ? 'positive' : 'negative';
  }
}