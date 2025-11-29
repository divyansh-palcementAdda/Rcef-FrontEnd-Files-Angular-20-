import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';

export interface TimelineEvent {
  id: number;
  type: 'task' | 'user' | 'system' | 'meeting' | 'milestone';
  title: string;
  description: string;
  user?: string;
  timestamp: Date;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  status?: 'completed' | 'in-progress' | 'pending' | 'cancelled';
  tags?: string[];
}

/** Strongly-Typed Stat Keys */
export type StatKey =
  | 'total'
  | 'tasks'
  | 'users'
  | 'systems'
  | 'meetings'
  | 'milestones';

/** Strongly-Typed Stats Object */
export type EventStats = Record<StatKey, number>;

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [CommonModule, GradientCardComponent],
  templateUrl: './activity-timeline.html',
  styleUrls: ['./activity-timeline.css']
})
export class ActivityTimelineComponent {

  @Input() dashboardData: any = null;

  /** Strongly-typed icon mapping */
  getStatIcon(key: StatKey): string {
    const icons: Record<StatKey, string> = {
      total: 'bi-activity',
      tasks: 'bi-clipboard-check',
      users: 'bi-people',
      systems: 'bi-gear',
      meetings: 'bi-calendar-event',
      milestones: 'bi-flag'
    };
    return icons[key];
  }

  /** Strongly-typed label mapping */
  getStatLabel(key: StatKey): string {
    const labels: Record<StatKey, string> = {
      total: 'Total Events',
      tasks: 'Tasks',
      users: 'Users',
      systems: 'System',
      meetings: 'Meetings',
      milestones: 'Milestones'
    };
    return labels[key];
  }

  /** DUMMY EVENTS */
  timelineEvents: TimelineEvent[] = [
    {
      id: 1,
      type: 'milestone',
      title: 'Q4 Launch Completed',
      description: 'Successfully launched all Q4 product features',
      user: 'Sarah Johnson',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      icon: 'bi-rocket',
      color: 'success',
      status: 'completed',
      tags: ['Launch', 'Product']
    },
    {
      id: 2,
      type: 'task',
      title: 'Database Optimization',
      description: 'Completed database performance optimization',
      user: 'Mike Chen',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      icon: 'bi-database',
      color: 'primary',
      status: 'completed',
      tags: ['Backend', 'Performance']
    },
    {
      id: 3,
      type: 'user',
      title: 'New Team Member',
      description: 'Robert Wilson joined the Sales department',
      user: 'System',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      icon: 'bi-person-plus',
      color: 'info',
      tags: ['Onboarding', 'HR']
    },
    {
      id: 4,
      type: 'meeting',
      title: 'Sprint Planning',
      description: 'Completed sprint planning for next cycle',
      user: 'Emily Davis',
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      icon: 'bi-calendar-event',
      color: 'warning',
      status: 'completed',
      tags: ['Planning', 'Development']
    },
    {
      id: 5,
      type: 'system',
      title: 'System Update',
      description: 'Applied latest security patches',
      user: 'System',
      timestamp: new Date(Date.now() - 1000 * 60 * 180),
      icon: 'bi-gear',
      color: 'info',
      tags: ['Maintenance', 'Security']
    },
    {
      id: 6,
      type: 'task',
      title: 'Marketing Campaign',
      description: 'Started Q1 marketing campaign planning',
      user: 'Lisa Thompson',
      timestamp: new Date(Date.now() - 1000 * 60 * 240),
      icon: 'bi-megaphone',
      color: 'primary',
      status: 'in-progress',
      tags: ['Marketing', 'Planning']
    }
  ];

  filteredEvents: TimelineEvent[] = [...this.timelineEvents];
  filterType: string = 'all';
  dateRange: string = 'today';

  getEventIcon(type: TimelineEvent['type']): string {
    const icons: Record<TimelineEvent['type'], string> = {
      task: 'bi-clipboard-check',
      user: 'bi-person',
      system: 'bi-gear',
      meeting: 'bi-calendar-event',
      milestone: 'bi-flag'
    };
    return icons[type] || 'bi-activity';
  }

  getEventColor(type: TimelineEvent['type']): string {
    const colors: Record<TimelineEvent['type'], string> = {
      task: 'primary',
      user: 'success',
      system: 'info',
      meeting: 'warning',
      milestone: 'danger'
    };
    return colors[type];
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

  getFormattedTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
asStatKey(key: string): StatKey {
  return key as StatKey;
}

  getStatusClass(status?: TimelineEvent['status']): string {
    const statusClasses: Record<NonNullable<TimelineEvent['status']>, string> = {
      completed: 'status-completed',
      'in-progress': 'status-in-progress',
      pending: 'status-pending',
      cancelled: 'status-cancelled'
    };
    return status ? statusClasses[status] : '';
  }

  getStatusIcon(status?: TimelineEvent['status']): string {
    const statusIcons: Record<NonNullable<TimelineEvent['status']>, string> = {
      completed: 'bi-check-circle',
      'in-progress': 'bi-play-circle',
      pending: 'bi-clock',
      cancelled: 'bi-x-circle'
    };
    return status ? statusIcons[status] : 'bi-circle';
  }

  applyFilters(): void {
    this.filteredEvents = this.timelineEvents.filter(event => {
      const matchesType = this.filterType === 'all' || event.type === this.filterType;

      const now = new Date().getTime();
      const eventTime = event.timestamp.getTime();
      let matchesDate = true;

      if (this.dateRange === 'today') {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        matchesDate = eventTime >= startOfDay;
      } else if (this.dateRange === 'week') {
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        matchesDate = eventTime >= weekAgo;
      }

      return matchesType && matchesDate;
    });
  }

  onFilterTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filterType = target.value;
    this.applyFilters();
  }

  onDateRangeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.dateRange = target.value;
    this.applyFilters();
  }

  exportTimeline(): void {
    console.log('Exporting timeline…');
  }

  viewFullTimeline(): void {
    console.log('Navigating to full timeline…');
  }

  /** Strongly Typed Event Stats Method */
  getEventStats(): EventStats {
    return {
      total: this.timelineEvents.length,
      tasks: this.timelineEvents.filter(e => e.type === 'task').length,
      users: this.timelineEvents.filter(e => e.type === 'user').length,
      systems: this.timelineEvents.filter(e => e.type === 'system').length,
      meetings: this.timelineEvents.filter(e => e.type === 'meeting').length,
      milestones: this.timelineEvents.filter(e => e.type === 'milestone').length
    };
  }

  addCustomEvent(): void {
    console.log('Adding custom event…');
  }
}
