import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskApiService } from '../../../Services/task-api-Service';
import { TaskDto } from '../../../Model/TaskDto';
import { tap, catchError, of } from 'rxjs';

export interface DelayedSubDeptInfo {
  subDepartmentName: string;
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
  delayedSubDepartments: DelayedSubDeptInfo[] = [];
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

          let tasks: TaskDto[] = response.data;

          // === FILTER LOGIC ===
          tasks = tasks.filter(task => {
            const creator = task.createdByName;
            const assignees = task.assignedToNames || [];

            // If no assignees → include
            if (assignees.length === 0) return true;

            // If creator undefined → include (not self-assigned)
            if (!creator) return true;

            // Case 1: Creator NOT in assignees → INCLUDE
            if (!assignees.includes(creator)) {
              return true;
            }

            // Case 2: Creator IS in assignees → EXCLUDE only if ONLY assignee
            return assignees.length > 1;
          });

          this.totalDelayed = tasks.length;

          // Group by sub department
          const subDeptMap = new Map<string, number>();
          tasks.forEach(task => {
            const subDepts = task.subDepartmentNames || [];
            subDepts.forEach(name => {
              subDeptMap.set(name, (subDeptMap.get(name) || 0) + 1);
            });
          });

          this.delayedSubDepartments = Array.from(subDeptMap.entries())
            .map(([subDepartmentName, delayedCount]) => ({ subDepartmentName, delayedCount }))
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
      this.headlineText = 'All tasks are on schedule across sub departments.';
      return;
    }

    this.headlineText = this.getDelayedHeadline(this.delayedSubDepartments, this.totalDelayed);
  }


  private getDelayedHeadline(subDeptInfo: { subDepartmentName: string, delayedCount: number }[], taskCount: number): string {
    const subDeptNamesWithCount = subDeptInfo.map(d => `${d.subDepartmentName} (${d.delayedCount})`);

    const subDeptLabel = subDeptInfo.length > 1 ? 'sub departments' : 'sub department';
    const taskLabel = taskCount > 1 ? 'tasks' : 'task';

    return `⚠️ ${taskCount} delayed ${taskLabel} detected in ${subDeptInfo.length} ${subDeptLabel}: ${subDeptNamesWithCount.join(', ')}. Please review and take necessary action.`;
  }
}