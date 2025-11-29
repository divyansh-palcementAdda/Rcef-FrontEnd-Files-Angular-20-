import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger' | 'system';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  icon: string;
  priority: 'low' | 'medium' | 'high';
}

@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  imports: [CommonModule, GradientCardComponent],
  templateUrl: './notifications-panel.html',
  styleUrls: ['./notifications-panel.css']
})
export class NotificationsPanelComponent {
  @Input() dashboardData: any = null;

  notifications: Notification[] = [
    {
      id: 1,
      title: 'New Task Assignment',
      message: 'You have been assigned to "Website Redesign Project"',
      type: 'info',
      timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      read: false,
      actionUrl: '/tasks/123',
      icon: 'bi-clipboard-plus',
      priority: 'medium'
    },
    {
      id: 2,
      title: 'Task Completed Successfully',
      message: 'Database optimization task has been completed ahead of schedule',
      type: 'success',
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
      read: true,
      actionUrl: '/tasks/456',
      icon: 'bi-check-circle',
      priority: 'low'
    },
    {
      id: 3,
      title: 'Approval Required',
      message: '3 tasks are awaiting your approval in the Marketing department',
      type: 'warning',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      read: false,
      actionUrl: '/approvals',
      icon: 'bi-shield-check',
      priority: 'high'
    },
    {
      id: 4,
      title: 'System Maintenance',
      message: 'Scheduled maintenance this weekend. System will be unavailable for 2 hours.',
      type: 'system',
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      read: true,
      icon: 'bi-gear',
      priority: 'medium'
    },
    {
      id: 5,
      title: 'Deadline Approaching',
      message: 'Q4 Marketing Campaign deadline is in 3 days',
      type: 'danger',
      timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      read: false,
      actionUrl: '/tasks/789',
      icon: 'bi-clock',
      priority: 'high'
    },
    {
      id: 6,
      title: 'New User Registration',
      message: 'John Smith has joined the Sales department',
      type: 'info',
      timestamp: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
      read: true,
      actionUrl: '/users/123',
      icon: 'bi-person-plus',
      priority: 'low'
    }
  ];

  filteredNotifications: Notification[] = [...this.notifications];
  filterType: string = 'all';
  showOnlyUnread: boolean = false;

  getNotificationIcon(type: string): string {
    const icons: { [key: string]: string } = {
      info: 'bi-info-circle',
      success: 'bi-check-circle',
      warning: 'bi-exclamation-triangle',
      danger: 'bi-x-circle',
      system: 'bi-gear'
    };
    return icons[type] || 'bi-bell';
  }

  getNotificationColor(type: string): string {
    const colors: { [key: string]: string } = {
      info: 'info',
      success: 'success',
      warning: 'warning',
      danger: 'danger',
      system: 'primary'
    };
    return colors[type] || 'secondary';
  }

  getPriorityIcon(priority: string): string {
    const icons: { [key: string]: string } = {
      low: 'bi-arrow-down',
      medium: 'bi-dash',
      high: 'bi-arrow-up'
    };
    return icons[priority] || 'bi-circle';
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

  markAsRead(notification: Notification): void {
    notification.read = true;
  }

  markAllAsRead(): void {
    this.notifications.forEach(notification => notification.read = true);
    this.applyFilters();
  }

  deleteNotification(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.notifications = this.notifications.filter(n => n.id !== notification.id);
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredNotifications = this.notifications.filter(notification => {
      const matchesType = this.filterType === 'all' || notification.type === this.filterType;
      const matchesReadStatus = !this.showOnlyUnread || !notification.read;
      return matchesType && matchesReadStatus;
    });
  }

  onFilterTypeChange(event: any): void {
    this.filterType = event.target.value;
    this.applyFilters();
  }

  onUnreadFilterChange(event: any): void {
    this.showOnlyUnread = event.target.checked;
    this.applyFilters();
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  getNotificationStats(): any {
    const total = this.notifications.length;
    const unread = this.getUnreadCount();
    const read = total - unread;

    return {
      total,
      unread,
      read,
      unreadPercentage: Math.round((unread / total) * 100)
    };
  }

  viewAllNotifications(): void {
    console.log('Navigating to all notifications...');
    // Navigate to notifications page
  }

  clearAllNotifications(): void {
    if (confirm('Are you sure you want to clear all notifications?')) {
      this.notifications = [];
      this.filteredNotifications = [];
    }
  }
}