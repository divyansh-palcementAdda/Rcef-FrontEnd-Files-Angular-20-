import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
interface Stat {
  icon: string;
  label: string;
  value: string;
  trend: string;
  color: string;
}

interface ProgressItem {
  label: string;
  value: number;
}

@Component({
  selector: 'app-dashboard-preview',
  imports: [CommonModule],
  templateUrl: './dashboard-preview.html',
  styleUrl: './dashboard-preview.css'
})
export class DashboardPreview {

  // todo: Update with actual dashboard image path
  dashboardImage = 'assets/images/dashboard-analytics-preview.png';

  stats = signal<Stat[]>([
    {
      icon: 'check-circle',
      label: 'Tasks Completed',
      value: '1,247',
      trend: '+12%',
      color: 'green'
    },
    {
      icon: 'trending-up',
      label: 'Team Performance',
      value: '94%',
      trend: '+8%',
      color: 'primary'
    },
    {
      icon: 'users',
      label: 'Active Members',
      value: '48',
      trend: '+3',
      color: 'purple'
    },
    {
      icon: 'file-text',
      label: 'Reports Generated',
      value: '156',
      trend: '+24%',
      color: 'blue'
    }
  ]);

  taskProgress = signal<ProgressItem[]>([
    { label: 'Development', value: 85 },
    { label: 'Design', value: 92 }
  ]);

  teamActivity = signal<ProgressItem[]>([
    { label: 'Marketing', value: 78 },
    { label: 'Sales', value: 65 }
  ]);

  completionRate = signal<ProgressItem[]>([
    { label: 'This Week', value: 94 },
    { label: 'This Month', value: 88 }
  ]);
}