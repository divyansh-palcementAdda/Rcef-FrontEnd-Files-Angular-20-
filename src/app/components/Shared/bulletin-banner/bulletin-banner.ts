import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskApiService } from '../../../Services/task-api-Service';
import { TaskDto } from '../../../Model/TaskDto';
import { tap, catchError, of } from 'rxjs';

export interface DelayedDeptInfo {
  departmentName: string;
  delayedCount: number;
}

@Component({
  selector: 'app-bulletin-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bulletin-banner.html',
  styleUrls: ['./bulletin-banner.css']
})
export class BulletinBannerComponent implements OnInit {
  delayedDepartments: DelayedDeptInfo[] = [];
  totalDelayed: number = 0;
  headlineText = '';
  isLoading = true;

  constructor(
    private taskApiService: TaskApiService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadDelayedTasksByDepartment();
  }

  private loadDelayedTasksByDepartment(): void {
    this.isLoading = true;
    this.taskApiService
      .getTasksByStatus('DELAYED')
      .pipe(
        tap(response => {
          if (!response.success || !response.data) {
            this.headlineText = 'System update: No delayed tasks at this time.';
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
          }

          const tasks: TaskDto[] = response.data;
          this.totalDelayed = tasks.length;

          // Group by department
          const deptMap = new Map<string, number>();
          tasks.forEach(task => {
            const depts = task.departmentNames || [];
            depts.forEach(name => {
              deptMap.set(name, (deptMap.get(name) || 0) + 1);
            });
          });

          this.delayedDepartments = Array.from(deptMap.entries())
            .map(([departmentName, delayedCount]) => ({ departmentName, delayedCount }))
            .sort((a, b) => b.delayedCount - a.delayedCount);

          this.generateBulletinMessage();
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        catchError(err => {
          console.error('Failed to load delayed tasks', err);
          this.headlineText = 'Notice: Temporary delay in updating task status.';
          this.isLoading = false;
          this.cdr.markForCheck();
          return of(null);
        })
      )
      .subscribe();
  }

  private generateBulletinMessage(): void {
    if (this.totalDelayed === 0) {
      this.headlineText = 'All tasks are on schedule across departments.';
      return;
    }

    const deptList = this.delayedDepartments
      .map(d => `${d.departmentName}: ${d.delayedCount} delayed`)
      .join(' • ');

    const taskWord = this.totalDelayed === 1 ? 'task is' : 'tasks are';
    this.headlineText = `⚠️ Attention: ${this.totalDelayed} ${taskWord} currently delayed. Please review the following departments: ${deptList}.`;
  }
}