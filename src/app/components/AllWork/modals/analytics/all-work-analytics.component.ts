import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AllWorkApiService, SubDepartmentRowDTO, UserRowDTO, WorkAnalyticsResponse } from '../../../../Services/all-work-api.service';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-all-work-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './all-work-analytics.component.html',
  styleUrls: ['./all-work-analytics.component.css']
})
export class AllWorkAnalyticsComponent implements OnInit, OnDestroy {
  @Input() subDept?: SubDepartmentRowDTO | null;
  @Input() user?: UserRowDTO | null;

  analytics: WorkAnalyticsResponse | null = null;
  loadingAnalytics = false;

  private subscriptions = new Subscription();

  constructor(private apiService: AllWorkApiService) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadAnalytics(): void {
    this.loadingAnalytics = true;
    let obs$;

    if (this.user) {
      obs$ = this.apiService.getUserAnalytics(this.user.userId);
    } else if (this.subDept) {
      obs$ = this.apiService.getSubDepartmentAnalytics(this.subDept.id);
    } else {
      this.loadingAnalytics = false;
      return;
    }

    this.subscriptions.add(
      obs$.pipe(finalize(() => {
        this.loadingAnalytics = false;
      }))
        .subscribe({
          next: (res) => {
            this.analytics = res;
          },
          error: (err) => {
            console.error('Failed to load analytics', err);
          }
        })
    );
  }

  getStatusDisplayName(key: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pending', IN_PROGRESS: 'In Progress', CLOSED: 'Completed',
      DELAYED: 'Delayed', UPCOMING: 'Upcoming', EXTENDED: 'Extended',
      REQUEST_FOR_CLOSURE: 'Closure Req.', REQUEST_FOR_EXTENSION: 'Extension Req.',
    };
    return map[key.toUpperCase()] || key;
  }

  getStatusDotClass(key: string): string {
    const map: Record<string, string> = {
      PENDING: 'aw-dot--pending', IN_PROGRESS: 'aw-dot--inprogress',
      CLOSED: 'aw-dot--closed', DELAYED: 'aw-dot--delayed',
      UPCOMING: 'aw-dot--upcoming', EXTENDED: 'aw-dot--extended',
      REQUEST_FOR_CLOSURE: 'aw-dot--rfc', REQUEST_FOR_EXTENSION: 'aw-dot--rfe',
    };
    return map[key.toUpperCase()] || 'aw-dot--default';
  }

  getStatusBarClass(key: string): string {
    const map: Record<string, string> = {
      PENDING: 'aw-fill--pending', IN_PROGRESS: 'aw-fill--inprogress',
      CLOSED: 'aw-fill--closed', DELAYED: 'aw-fill--delayed',
      UPCOMING: 'aw-fill--upcoming', EXTENDED: 'aw-fill--extended',
      REQUEST_FOR_CLOSURE: 'aw-fill--rfc', REQUEST_FOR_EXTENSION: 'aw-fill--rfe',
    };
    return map[key.toUpperCase()] || 'aw-fill--default';
  }
}
