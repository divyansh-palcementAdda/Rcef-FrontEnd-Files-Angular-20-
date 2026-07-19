import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AllWorkApiService, SubDepartmentRowDTO, UserRowDTO, WorkDashboardResponse } from '../../../../Services/all-work-api.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-all-work-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './all-work-tasks.component.html',
  styleUrls: ['./all-work-tasks.component.css']
})
export class AllWorkTasksComponent implements OnInit, OnDestroy {
  Math = Math;

  @Input() subDept?: SubDepartmentRowDTO | null;
  @Input() user?: UserRowDTO | null;
  @Input() dashboardData!: WorkDashboardResponse | null;
  @Input() onNavigateEntity!: (type: string, id: any, event?: Event) => void;

  tasks: any[] = [];
  totalTasks = 0;
  taskSearch = '';
  taskStatus = 'ALL';
  taskPage = 0;
  taskSize = 10;
  taskSort = 'createdAt,desc';
  loadingTasks = false;

  statusTabs = [
    { label: 'All', value: 'ALL' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Delayed', value: 'DELAYED' },
    { label: 'Upcoming', value: 'UPCOMING' },
    { label: 'Extended', value: 'EXTENDED' },
    { label: 'Closure Requests', value: 'CLOSURE_REQUESTS' },
    { label: 'Extension Requests', value: 'EXTENSION_REQUESTS' },
    { label: 'Recurring Parent', value: 'RECURRING_PARENT' }
  ];

  private subscriptions = new Subscription();

  constructor(
    private apiService: AllWorkApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    if (params['taskSearch'] !== undefined) this.taskSearch = params['taskSearch'] || '';
    if (params['taskStatus'] !== undefined) this.taskStatus = params['taskStatus'] || 'ALL';
    if (params['taskPage'] !== undefined) this.taskPage = parseInt(params['taskPage'], 10) || 0;
    if (params['taskSize'] !== undefined) this.taskSize = parseInt(params['taskSize'], 10) || 10;
    if (params['taskSort'] !== undefined) this.taskSort = params['taskSort'] || 'createdAt,desc';

    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTasks(): void {
    this.loadingTasks = true;
    let obs$;

    if (this.user) {
      obs$ = this.apiService.getUserTasks(this.user.userId, this.taskSearch, this.taskStatus, this.taskPage, this.taskSize, this.taskSort);
    } else if (this.subDept) {
      obs$ = this.apiService.getSubDepartmentTasks(this.subDept.id, this.taskSearch, this.taskStatus, this.taskPage, this.taskSize, this.taskSort);
    } else {
      this.loadingTasks = false;
      return;
    }

    this.subscriptions.add(
      obs$.pipe(finalize(() => {
        this.loadingTasks = false;
      }))
        .subscribe({
          next: (res) => {
            this.tasks = res.content || [];
            this.totalTasks = res.page?.totalElements !== undefined ? res.page.totalElements : (res.totalElements || 0);
          },
          error: (err) => {
            console.error('Failed to load tasks', err);
          }
        })
    );
  }

  selectStatusTab(status: string): void {
    this.taskStatus = status;
    this.taskPage = 0;
    this.updateQueryParams();
    this.loadTasks();
  }

  onTaskSearchChange(): void {
    this.taskPage = 0;
    this.updateQueryParams();
    this.loadTasks();
  }

  changeTaskPage(delta: number): void {
    this.taskPage += delta;
    this.updateQueryParams();
    this.loadTasks();
  }

  exportTasks(format: string): void {
    let url = '';
    if (this.user) {
      url = this.apiService.getExportTasksUrl(null, this.user.userId, this.taskSearch, this.taskStatus, format);
    } else if (this.subDept) {
      url = this.apiService.getExportTasksUrl(this.subDept.id, null, this.taskSearch, this.taskStatus, format);
    }
    if (url) {
      window.open(url, '_blank');
    }
  }

  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        taskSearch: this.taskSearch || null,
        taskStatus: this.taskStatus || null,
        taskPage: this.taskPage || null,
        taskSize: this.taskSize || null,
        taskSort: this.taskSort || null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  getStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':              return 'aw-status--pending';
      case 'IN_PROGRESS':          return 'aw-status--inprogress';
      case 'CLOSED':               return 'aw-status--closed';
      case 'DELAYED':              return 'aw-status--delayed';
      case 'UPCOMING':             return 'aw-status--upcoming';
      case 'EXTENDED':             return 'aw-status--extended';
      case 'REQUEST_FOR_CLOSURE':  return 'aw-status--rfc';
      case 'REQUEST_FOR_EXTENSION':return 'aw-status--rfe';
      default:                     return 'aw-status--default';
    }
  }

  getStatusLabel(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':              return 'Pending';
      case 'IN_PROGRESS':          return 'In Progress';
      case 'CLOSED':               return 'Completed';
      case 'DELAYED':              return 'Delayed';
      case 'UPCOMING':             return 'Upcoming';
      case 'EXTENDED':             return 'Extended';
      case 'REQUEST_FOR_CLOSURE':  return 'Closure Req.';
      case 'REQUEST_FOR_EXTENSION':return 'Extension Req.';
      default:                     return status || '—';
    }
  }

  getPriorityClass(priority: string): string {
    switch ((priority || 'LOW').toUpperCase()) {
      case 'HIGH':   return 'aw-priority--high';
      case 'MEDIUM': return 'aw-priority--medium';
      default:       return 'aw-priority--low';
    }
  }

  getDueDateClass(dueDate: any, status: string): string {
    if (!dueDate || ['CLOSED', 'COMPLETED'].includes((status || '').toUpperCase())) return '';
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    if (due < now) return 'aw-date--overdue';
    if (due - now < 3 * 24 * 60 * 60 * 1000) return 'aw-date--soon';
    return '';
  }
}
