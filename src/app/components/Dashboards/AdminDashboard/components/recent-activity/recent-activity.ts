import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';

export interface Activity {
  id: number;
  user: string;
  action: string;
  target: string;
  timestamp: Date;
  type: 'task' | 'user' | 'system' | 'department';
  read: boolean;
}

@Component({
  selector: 'app-recent-activity',
  standalone: true,
  imports: [CommonModule, GradientCardComponent],
  templateUrl: './recent-activity.html',
  styleUrls: ['./recent-activity.css']
})
export class RecentActivityComponent {
  @Input() dashboardData: any = null;

  activities: Activity[] = [
    {
      id: 1,
      user: 'Sarah Johnson',
      action: 'completed',
      target: 'Q4 Financial Report',
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      type: 'task',
      read: false
    },
    {
      id: 2,
      user: 'Mike Chen',
      action: 'assigned',
      target: 'Website Redesign Project',
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      type: 'task',
      read: true
    },
    {
      id: 3,
      user: 'System',
      action: 'created',
      target: 'New Department: Marketing',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      type: 'department',
      read: true
    },
    {
      id: 4,
      user: 'Emily Davis',
      action: 'requested extension for',
      target: 'Product Launch Timeline',
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      type: 'task',
      read: true
    },
    {
      id: 5,
      user: 'Admin',
      action: 'added new user',
      target: 'Robert Wilson',
      timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      type: 'user',
      read: true
    }
  ];

  getActivityIcon(type: string): string {
    const icons = {
      task: 'bi-clipboard-check',
      user: 'bi-person-plus',
      system: 'bi-gear',
      department: 'bi-building'
    };
    return icons[type as keyof typeof icons] || 'bi-activity';
  }

  getActivityColor(type: string): string {
    const colors = {
      task: 'primary',
      user: 'success',
      system: 'info',
      department: 'warning'
    };
    return colors[type as keyof typeof colors] || 'secondary';
  }

  getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  markAsRead(activity: Activity): void {
    activity.read = true;
  }

  viewAllActivities(): void {
    console.log('View all activities clicked');
    // Navigate to activities page
  }
}