import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AllWorkApiService, SubDepartmentRowDTO, UserRowDTO, WorkDashboardResponse } from '../../../../Services/all-work-api.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-all-work-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './all-work-users.component.html',
  styleUrls: ['./all-work-users.component.css']
})
export class AllWorkUsersComponent implements OnInit, OnDestroy {
  Math = Math;

  @Input() subDept!: SubDepartmentRowDTO;
  @Input() dashboardData!: WorkDashboardResponse | null;
  @Input() onOpenUserTasks!: (user: UserRowDTO) => void;
  @Input() onOpenUserAnalytics!: (user: UserRowDTO) => void;
  @Input() onNavigateEntity!: (type: string, id: any, event?: Event) => void;

  users: UserRowDTO[] = [];
  totalUsers = 0;
  userSearch = '';
  userPage = 0;
  userSize = 10;
  userSort = 'fullName,asc';
  loadingUsers = false;

  private subscriptions = new Subscription();

  constructor(
    private apiService: AllWorkApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    if (params['userSearch'] !== undefined) this.userSearch = params['userSearch'] || '';
    if (params['userPage'] !== undefined) this.userPage = parseInt(params['userPage'], 10) || 0;
    if (params['userSize'] !== undefined) this.userSize = parseInt(params['userSize'], 10) || 10;
    if (params['userSort'] !== undefined) this.userSort = params['userSort'] || 'fullName,asc';

    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadUsers(): void {
    if (!this.subDept) return;
    this.loadingUsers = true;
    this.subscriptions.add(
      this.apiService.getSubDepartmentUsers(this.subDept.id, this.userSearch, this.userPage, this.userSize, this.userSort)
        .pipe(finalize(() => {
          this.loadingUsers = false;
        }))
        .subscribe({
          next: (res) => {
            this.users = res.content || [];
            this.totalUsers = res.page?.totalElements !== undefined ? res.page.totalElements : (res.totalElements || 0);
          },
          error: (err) => {
            console.error('Failed to load subdepartment users', err);
          }
        })
    );
  }

  onUserSearchChange(): void {
    this.userPage = 0;
    this.updateQueryParams();
    this.loadUsers();
  }

  changeUserPage(delta: number): void {
    this.userPage += delta;
    this.updateQueryParams();
    this.loadUsers();
  }

  exportUsers(format: string): void {
    if (!this.subDept) return;
    const url = this.apiService.getExportUsersUrl(this.subDept.id, this.userSearch, format);
    window.open(url, '_blank');
  }

  private updateQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        userSearch: this.userSearch || null,
        userPage: this.userPage || null,
        userSize: this.userSize || null,
        userSort: this.userSort || null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  getAvatarClass(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'HOD':       return 'aw-avatar--hod';
      case 'TEACHER':   return 'aw-avatar--teacher';
      case 'ADMIN':     return 'aw-avatar--admin';
      case 'SUB_ADMIN': return 'aw-avatar--subadmin';
      default:          return 'aw-avatar--default';
    }
  }

  getRoleBadgeClass(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'HOD':       return 'aw-role-badge--hod';
      case 'TEACHER':   return 'aw-role-badge--teacher';
      case 'ADMIN':     return 'aw-role-badge--admin';
      case 'SUB_ADMIN': return 'aw-role-badge--subadmin';
      default:          return 'aw-role-badge--default';
    }
  }
}
