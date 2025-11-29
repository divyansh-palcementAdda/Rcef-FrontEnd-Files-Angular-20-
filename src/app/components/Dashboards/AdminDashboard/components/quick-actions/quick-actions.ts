import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';

export interface QuickAction {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  route: string;
  params?: any;
  enabled: boolean;
  shortcut?: string;
}

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [CommonModule, GradientCardComponent],
  templateUrl: './quick-actions.html',
  styleUrls: ['./quick-actions.css']
})
export class QuickActionsComponent {
  @Output() actionSelected = new EventEmitter<{ route: string; params?: any }>();

  quickActions: QuickAction[] = [
    {
      id: 1,
      title: 'Create Task',
      description: 'Add a new task to the system',
      icon: 'bi-plus-circle',
      color: 'primary',
      route: '/add-task',
      enabled: true,
      shortcut: 'Ctrl+T'
    },
    {
      id: 2,
      title: 'Assign User',
      description: 'Assign user to department or task',
      icon: 'bi-person-plus',
      color: 'success',
      route: '/assign-user',
      enabled: true,
      shortcut: 'Ctrl+U'
    },
    {
      id: 3,
      title: 'Generate Report',
      description: 'Create performance or analytics report',
      icon: 'bi-graph-up',
      color: 'info',
      route: '/generate-report',
      enabled: true,
      shortcut: 'Ctrl+R'
    },
    {
      id: 4,
      title: 'Schedule Meeting',
      description: 'Schedule team or department meeting',
      icon: 'bi-calendar-event',
      color: 'warning',
      route: '/schedule-meeting',
      enabled: true,
      shortcut: 'Ctrl+M'
    },
    {
      id: 5,
      title: 'Approve Requests',
      description: 'Review and approve pending requests',
      icon: 'bi-shield-check',
      color: 'danger',
      route: '/approvals',
      params: { status: 'pending' },
      enabled: true,
      shortcut: 'Ctrl+A'
    },
    {
      id: 6,
      title: 'System Settings',
      description: 'Configure system preferences',
      icon: 'bi-gear',
      color: 'info',
      route: '/settings',
      enabled: true,
      shortcut: 'Ctrl+S'
    },
    {
      id: 7,
      title: 'User Management',
      description: 'Manage user roles and permissions',
      icon: 'bi-people',
      color: 'success',
      route: '/user-management',
      enabled: true,
      shortcut: 'Ctrl+U'
    },
    {
      id: 8,
      title: 'Data Export',
      description: 'Export system data in various formats',
      icon: 'bi-download',
      color: 'primary',
      route: '/data-export',
      enabled: true,
      shortcut: 'Ctrl+E'
    }
  ];

  onActionClick(action: QuickAction): void {
    if (action.enabled) {
      this.actionSelected.emit({
        route: action.route,
        params: action.params
      });
    }
  }

  getGradientClass(color: string): string {
    return `gradient-${color}`;
  }

  executeShortcut(shortcut: string): void {
    console.log(`Executing shortcut: ${shortcut}`);
    // Implement keyboard shortcut functionality
  }

  getRecentActions(): QuickAction[] {
    return this.quickActions.slice(0, 4); // Return first 4 as recent
  }

  getFavoriteActions(): QuickAction[] {
    return this.quickActions.filter(action => 
      ['Create Task', 'Generate Report', 'Approve Requests'].includes(action.title)
    );
  }
}