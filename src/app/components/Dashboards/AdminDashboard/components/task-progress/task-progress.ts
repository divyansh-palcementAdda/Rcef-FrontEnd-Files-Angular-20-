import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';

export interface Task {
  id: number;
  title: string;
  description: string;
  assignee: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  progress: number;
  dueDate: Date;
  estimatedHours: number;
  actualHours?: number;
  tags: string[];
}

/** Strong Typed Keys for Stats */
export type TaskStatKey =
  | 'total'
  | 'completed'
  | 'inProgress'
  | 'pending'
  | 'delayed'
  | 'overdue'
  | 'completionRate';

/** Strong typed stats object */
export type TaskStats = Record<TaskStatKey, number>;

@Component({
  selector: 'app-task-progress',
  standalone: true,
  imports: [CommonModule, GradientCardComponent],
  templateUrl: './task-progress.html',
  styleUrls: ['./task-progress.css']
})
export class TaskProgressComponent {

  @Input() dashboardData: any = null;

  tasks: Task[] = [
    {
      id: 1,
      title: 'Website Redesign',
      description: 'Complete homepage and dashboard redesign',
      assignee: 'Mike Chen',
      department: 'Development',
      priority: 'high',
      status: 'in-progress',
      progress: 75,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      estimatedHours: 40,
      actualHours: 32,
      tags: ['UI/UX', 'Frontend']
    },
    {
      id: 2,
      title: 'Q4 Marketing Campaign',
      description: 'Launch holiday marketing campaign',
      assignee: 'Emily Davis',
      department: 'Marketing',
      priority: 'critical',
      status: 'pending',
      progress: 20,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      estimatedHours: 60,
      actualHours: 12,
      tags: ['Campaign', 'Social Media']
    },
    {
      id: 3,
      title: 'Database Optimization',
      description: 'Optimize queries and indexing',
      assignee: 'Sarah Johnson',
      department: 'Development',
      priority: 'medium',
      status: 'completed',
      progress: 100,
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      estimatedHours: 24,
      actualHours: 20,
      tags: ['Backend', 'Performance']
    },
    {
      id: 4,
      title: 'Sales Training',
      description: 'New product training for sales team',
      assignee: 'Robert Wilson',
      department: 'Sales',
      priority: 'high',
      status: 'delayed',
      progress: 45,
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
      estimatedHours: 16,
      actualHours: 10,
      tags: ['Training', 'Onboarding']
    },
    {
      id: 5,
      title: 'Mobile App Update',
      description: 'Release mobile app update',
      assignee: 'Lisa Thompson',
      department: 'Development',
      priority: 'medium',
      status: 'in-progress',
      progress: 60,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      estimatedHours: 80,
      actualHours: 48,
      tags: ['Mobile', 'Release']
    }
  ];

  filteredTasks: Task[] = [...this.tasks];
  statusFilter: string = 'all';
  priorityFilter: string = 'all';
  departmentFilter: string = 'all';

  // ⬇ STATUS
  getStatusClass(status: Task['status']): string {
    const statusClasses: Record<Task['status'], string> = {
      pending: 'status-pending',
      'in-progress': 'status-in-progress',
      completed: 'status-completed',
      delayed: 'status-delayed'
    };
    return statusClasses[status];
  }

  getStatusIcon(status: Task['status']): string {
    const statusIcons: Record<Task['status'], string> = {
      pending: 'bi-clock',
      'in-progress': 'bi-play-circle',
      completed: 'bi-check-circle',
      delayed: 'bi-exclamation-triangle'
    };
    return statusIcons[status];
  }

  // ⬇ PRIORITY
  getPriorityClass(priority: Task['priority']): string {
    const priorityClasses: Record<Task['priority'], string> = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high',
      critical: 'priority-critical'
    };
    return priorityClasses[priority];
  }

  getPriorityIcon(priority: Task['priority']): string {
    const priorityIcons: Record<Task['priority'], string> = {
      low: 'bi-arrow-down',
      medium: 'bi-dash',
      high: 'bi-arrow-up',
      critical: 'bi-exclamation-triangle'
    };
    return priorityIcons[priority];
  }

  // ⬇ STRONG-TYPED STAT ICONS
  getStatIcon(key: TaskStatKey): string {
    const icons: Record<TaskStatKey, string> = {
      total: 'bi-clipboard',
      completed: 'bi-check-circle',
      inProgress: 'bi-play-circle',
      pending: 'bi-clock',
      delayed: 'bi-exclamation-triangle',
      overdue: 'bi-calendar-x',
      completionRate: 'bi-graph-up'
    };
    return icons[key];
  }

  getStatLabel(key: TaskStatKey): string {
    const labels: Record<TaskStatKey, string> = {
      total: 'Total Tasks',
      completed: 'Completed',
      inProgress: 'In Progress',
      pending: 'Pending',
      delayed: 'Delayed',
      overdue: 'Overdue',
      completionRate: 'Completion Rate'
    };
    return labels[key];
  }

  /** Wrapper so Angular template can pass string -> TaskStatKey */
  asTaskStatKey(key: string): TaskStatKey {
    return key as TaskStatKey;
  }

  // ⬇ UTILITIES
  getDaysUntilDue(dueDate: Date): number {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  isOverdue(dueDate: Date): boolean {
    return dueDate < new Date();
  }

  getProgressColor(progress: number): string {
    if (progress >= 90) return 'progress-success';
    if (progress >= 70) return 'progress-warning';
    if (progress >= 50) return 'progress-info';
    return 'progress-danger';
  }

  // ⬇ FILTERS
  applyFilters(): void {
    this.filteredTasks = this.tasks.filter(task => {
      const matchesStatus = this.statusFilter === 'all' || task.status === this.statusFilter;
      const matchesPriority = this.priorityFilter === 'all' || task.priority === this.priorityFilter;
      const matchesDepartment = this.departmentFilter === 'all' || task.department === this.departmentFilter;

      return matchesStatus && matchesPriority && matchesDepartment;
    });
  }

  onStatusFilterChange(event: any): void {
    this.statusFilter = event.target.value;
    this.applyFilters();
  }

  onPriorityFilterChange(event: any): void {
    this.priorityFilter = event.target.value;
    this.applyFilters();
  }

  onDepartmentFilterChange(event: any): void {
    this.departmentFilter = event.target.value;
    this.applyFilters();
  }

  getDepartments(): string[] {
    return [...new Set(this.tasks.map(t => t.department))];
  }
  

  /** STRONG-TYPED Task Stats Output */
  getTaskStats(): TaskStats {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const inProgress = this.tasks.filter(t => t.status === 'in-progress').length;
    const pending = this.tasks.filter(t => t.status === 'pending').length;
    const delayed = this.tasks.filter(t => t.status === 'delayed').length;
    const overdue = this.tasks.filter(t => this.isOverdue(t.dueDate)).length;

    return {
      total,
      completed,
      inProgress,
      pending,
      delayed,
      overdue,
      completionRate: Math.round((completed / total) * 100)
    };
  }

  viewTaskDetails(task: Task): void {
    console.log('Viewing task:', task.title);
  }

  quickUpdateProgress(task: Task, progress: number): void {
    task.progress = progress;
    if (progress === 100) {
      task.status = 'completed';
    } else if (progress > 0) {
      task.status = 'in-progress';
    }
    console.log(`Updated ${task.title} progress to ${progress}%`);
  }
}
