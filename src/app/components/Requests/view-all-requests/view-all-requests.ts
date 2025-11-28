import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { RequestApiService } from '../../../Services/request-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { TaskRequestDto } from '../../../Model/TaskRequestDto';
import { AuthApiService } from '../../../Services/auth-api-service';

type RequestType = 'CLOSURE' | 'EXTENSION';
type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Filters {
  search: string;
  type: RequestType | 'ALL';
  status: RequestStatus | 'ALL';  // ← Still needed internally
}

@Component({
  selector: 'app-view-all-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './view-all-requests.html',
  styleUrls: ['./view-all-requests.css']
})
export class ViewAllRequests implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  requests: TaskRequestDto[] = [];
  filteredRequests: TaskRequestDto[] = [];
  loading = true;
  errorMessage: string | null = null;

  currentRole: string = '';
  currentUserId!: number;

  filters: Filters = { search: '', type: 'ALL', status: 'ALL' };

  // Pagination
  currentPage = 1;
  pageSize = 10;
  get totalPages(): number {
    return Math.ceil(this.filteredRequests.length / this.pageSize) || 1;
  }

  constructor(
    private requestService: RequestApiService,
    private router: Router,
    private route: ActivatedRoute,
    private jwtService: JwtService,
    private authApiService: AuthApiService
  ) { }

  ngOnInit(): void {
    this.loadCurrentUserAndRequests();

    // Listen to query params — ONLY for status
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const statusParam = params['status']?.toUpperCase();

        if (statusParam && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusParam)) {
          this.filters.status = statusParam as RequestStatus;
        } else {
          this.filters.status = 'ALL';
        }

        // Re-apply filters whenever URL changes
        this.applyFilters();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentUserAndRequests(): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const decoded = this.jwtService.decodeToken(token);
    if (!decoded) {
      this.errorMessage = 'Invalid token';
      this.loading = false;
      return;
    }

    this.currentUserId = decoded['userId'];
    this.currentRole = (decoded['role'] as string || '').toUpperCase();

    this.loadRequests();
  }

  private loadRequests(): void {
    this.loading = true;
    this.errorMessage = null;

    let request$: any;

    switch (this.currentRole) {
      case 'ADMIN':
        request$ = this.requestService.getAllRequests();
        break;
      case 'HOD':
        request$ = this.requestService.getRequestsByHodDepartments();
        break;
      case 'TEACHER':
        request$ = this.requestService.getMyRequests();
        break;
      default:
        this.errorMessage = 'Access denied';
        this.loading = false;
        return;
    }

    request$.subscribe({
      next: (response: any) => {
        this.requests = response?.data || [];
        this.applyFilters(); // Re-apply with current status from URL
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Failed to load requests';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let result = [...this.requests];

    if (this.filters.search.trim()) {
      const term = this.filters.search.toLowerCase();
      result = result.filter(r =>
        r.taskTitle?.toLowerCase().includes(term) ||
        r.requestedByName?.toLowerCase().includes(term) ||
        r.remarks?.toLowerCase().includes(term)
      );
    }

    if (this.filters.type !== 'ALL') {
      result = result.filter(r => r.requestType === this.filters.type);
    }

    // Status filter is controlled ONLY by URL
    if (this.filters.status !== 'ALL') {
      result = result.filter(r => r.status === this.filters.status);
    }

    this.filteredRequests = result;
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.filters = { search: '', type: 'ALL', status: this.filters.status }; // Keep status from URL
    this.applyFilters();
    // Do NOT clear status from URL — it's external control
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get paginatedRequests(): TaskRequestDto[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRequests.slice(start, start + this.pageSize);
  }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  getStatusClass(status: RequestStatus): string {
    switch (status) {
      case 'PENDING': return 'bg-warning text-dark blink';
      case 'APPROVED': return 'bg-success text-white';
      case 'REJECTED': return 'bg-danger text-white';
      default: return 'bg-secondary';
    }
  }

  getTypeBadge(type: RequestType): { text: string; icon: string } {
    return type === 'EXTENSION'
      ? { text: 'Extension Request', icon: 'bi-clock-history' }
      : { text: 'Closure Request', icon: 'bi-lock-fill' };
  }

  navigateToTask(taskId: number): void {
    if (taskId > 0) {
      this.router.navigate(['/task', taskId]);
    }
  }

  goBackToDashboard() {
    this.authApiService.goToDashboard();
  }

  refresh(): void {
    this.loadRequests();
  }
}