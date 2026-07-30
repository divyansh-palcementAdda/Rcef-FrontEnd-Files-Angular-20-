import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, catchError, takeUntil } from 'rxjs/operators';

import { RequestApiService } from '../../../Services/request-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { TaskRequestDto } from '../../../Model/TaskRequestDto';
import { FilterDrawerComponent, FilterFieldConfig } from '../../Shared/filter-drawer/filter-drawer.component';
import { PageToolbarComponent } from '../../Shared/page-toolbar/page-toolbar.component';
import { AnalyticsStatCardComponent } from '../../Shared/analytics-stat-card/analytics-stat-card.component';
import { DragScrollDirective } from '../../Shared/directives/drag-scroll.directive';

@Component({
  selector: 'app-view-all-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FilterDrawerComponent, PageToolbarComponent, AnalyticsStatCardComponent, DragScrollDirective],
  templateUrl: './view-all-requests.html',
  styleUrls: ['./view-all-requests.css']
})
export class ViewAllRequests implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();

  // Search results
  requests: any[] = [];
  totalElements = 0;
  totalPages = 1;
  currentPage = 1;
  pageSize = 10;
  sortBy = 'requestedDate';
  sortDirection = 'desc';
  loading = false;
  isInitialLoad = true;
  errorMessage: string | null = null;
  isForbidden = false;

  // Filters state
  searchTerm = '';
  requestTypeFilter = '';
  statusFilter = '';
  priorityFilter = '';
  taskTypeFilter = '';
  hasProofFilter = '';
  departmentIdFilter = '';
  subDepartmentIdFilter = '';
  onlyActionableRequestsFilter = '';
  onlyMyRequestsFilter = '';

  // Dropdown options (dynamic)
  departmentsList: any[] = [];
  subDepartmentsList: any[] = [];
  filterFields: FilterFieldConfig[] = [];
  filterValues: { [key: string]: any } = {};

  // Stats
  stats: {
    totalRequests: number;
    pending: number;
    approved: number;
    rejected: number;
    extensionRequests: number;
    closureRequests: number;
    total?: { total: number; pending: number; approved: number; rejected: number };
    closure?: { total: number; pending: number; approved: number; rejected: number };
    extension?: { total: number; pending: number; approved: number; rejected: number };
  } = {
    totalRequests: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    extensionRequests: 0,
    closureRequests: 0
  };

  /** Dynamically returns the status breakdown for the active Request Type context */
  get activeStatusStats(): { total: number; pending: number; approved: number; rejected: number } {
    const s = this.stats || {};
    if (this.requestTypeFilter === 'CLOSURE' && s.closure) {
      return s.closure;
    } else if (this.requestTypeFilter === 'EXTENSION' && s.extension) {
      return s.extension;
    } else if (s.total) {
      return s.total;
    }
    return {
      total: s.totalRequests || 0,
      pending: s.pending || 0,
      approved: s.approved || 0,
      rejected: s.rejected || 0
    };
  }


  selectedCard = 'total';

  filterDrawerOpen = false;
  protected readonly Math = Math;

  // Role info
  currentRole = '';
  currentUserId!: number;

  // Active Modals state
  activeRequestDetail: any = null;
  loadingDetail = false;

  approveDialog: {
    isOpen: boolean;
    requestId: number | null;
    requestType: string | null;
    remarks: string;
    newDueDate: string;
  } = {
      isOpen: false,
      requestId: null,
      requestType: null,
      remarks: '',
      newDueDate: ''
    };

  rejectDialog: {
    isOpen: boolean;
    requestId: number | null;
    reason: string;
  } = {
      isOpen: false,
      requestId: null,
      reason: ''
    };

  constructor(
    private requestService: RequestApiService,
    private router: Router,
    private route: ActivatedRoute,
    private jwtService: JwtService,
    private authApiService: AuthApiService,
    private location: Location,
  ) { }

  ngOnInit(): void {
    this.loadCurrentUser();

    // Listen to query params for status triggers (e.g. from Dashboard cards)
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        const statusParam = params['status']?.toUpperCase();
        if (statusParam && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusParam)) {
          this.statusFilter = statusParam;
          this.selectedCard = statusParam.toLowerCase();
        } else {
          this.statusFilter = '';
          this.selectedCard = 'total';
        }

        const typeParam = params['type']?.toUpperCase();
        if (typeParam && ['CLOSURE', 'EXTENSION'].includes(typeParam)) {
          this.requestTypeFilter = typeParam;
        }

        this.currentPage = 1;
        this.loadRequestsFromServer();
      })
    );

    this.initializeFilterFields();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentUser(): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }
    const decoded = this.jwtService.decodeToken(token);
    if (decoded) {
      this.currentUserId = decoded['userId'];
      this.currentRole = this.authApiService.getCurrentRole() ?? '';
    }
  }

  initializeFilterFields(): void {
    this.filterFields = [
      { key: 'searchTerm', label: 'Search Keyword', type: 'text', section: 'general', placeholder: 'Enter keywords...' },
      {
        key: 'requestTypeFilter',
        label: 'Request Type',
        type: 'select',
        section: 'general',
        options: [
          { value: 'CLOSURE', label: 'Closure Request' },
          { value: 'EXTENSION', label: 'Extension Request' }
        ]
      },
      {
        key: 'statusFilter',
        label: 'Request Status',
        type: 'select',
        section: 'general',
        options: [
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' }
        ]
      },
      {
        key: 'priorityFilter',
        label: 'Task Priority',
        type: 'select',
        section: 'general',
        options: [
          { value: 'HIGH', label: 'High' },
          { value: 'MEDIUM', label: 'Medium' },
          { value: 'LOW', label: 'Low' }
        ]
      },
      {
        key: 'taskTypeFilter',
        label: 'Task Type',
        type: 'select',
        section: 'general',
        options: [
          { value: 'TEMPLATE', label: 'Template' },
          { value: 'GENERAL', label: 'General' }
        ]
      },
      {
        key: 'hasProofFilter',
        label: 'Has Proofs',
        type: 'select',
        section: 'general',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' }
        ]
      },
      {
        key: 'departmentIdFilter',
        label: 'Department',
        type: 'select',
        section: 'organization',
        options: this.departmentsList.map(d => ({ value: d.id, label: d.name }))
      },
      {
        key: 'subDepartmentIdFilter',
        label: 'Sub Department',
        type: 'select',
        section: 'organization',
        options: this.subDepartmentsList.map(s => ({ value: s.id, label: s.name }))
      },
      {
        key: 'onlyActionableRequestsFilter',
        label: 'Actionable by Me',
        type: 'select',
        section: 'advanced',
        options: [
          { value: 'true', label: 'Actionable only' },
          { value: 'false', label: 'All' }
        ]
      },
      {
        key: 'onlyMyRequestsFilter',
        label: 'My Requests Only',
        type: 'select',
        section: 'advanced',
        options: [
          { value: 'true', label: 'My requests' },
          { value: 'false', label: 'All' }
        ]
      }
    ];

    this.filterValues = {
      searchTerm: this.searchTerm,
      requestTypeFilter: this.requestTypeFilter,
      statusFilter: this.statusFilter,
      priorityFilter: this.priorityFilter,
      taskTypeFilter: this.taskTypeFilter,
      hasProofFilter: this.hasProofFilter,
      departmentIdFilter: this.departmentIdFilter,
      subDepartmentIdFilter: this.subDepartmentIdFilter,
      onlyActionableRequestsFilter: this.onlyActionableRequestsFilter,
      onlyMyRequestsFilter: this.onlyMyRequestsFilter
    };
  }

  loadRequestsFromServer(): void {
    this.loading = true;
    this.errorMessage = null;

    const params: any = {
      page: this.currentPage - 1,
      size: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
      search: this.searchTerm,
      departmentId: this.departmentIdFilter,
      subDepartmentId: this.subDepartmentIdFilter,
      requestType: this.requestTypeFilter,
      status: this.statusFilter,
      taskPriority: this.priorityFilter,
      taskType: this.taskTypeFilter,
      hasProof: this.hasProofFilter !== '' ? this.hasProofFilter === 'true' : '',
      onlyPending: this.statusFilter === 'PENDING' ? 'true' : '',
      onlyMyRequests: this.onlyMyRequestsFilter === 'true' ? 'true' : '',
      onlyActionableRequests: this.onlyActionableRequestsFilter === 'true' ? 'true' : ''
    };

    this.subscriptions.add(
      this.requestService.searchRequests(params)
        .pipe(
          finalize(() => {
            this.loading = false;
            this.isInitialLoad = false;
          }),
          catchError(err => {
            if (err.status === 403) {
              this.isForbidden = true;
            } else {
              this.errorMessage = err?.error?.message || 'Failed to load requests';
            }
            return of({ success: false, data: null });
          })
        )
        .subscribe(res => {
          if (res?.success && res.data) {
            const data = res.data;
            this.requests = data.content || [];
            this.totalElements = data.totalElements || 0;
            this.totalPages = data.totalPages || 1;

            if (data.stats) {
              this.stats = data.stats;
            }

            // Sync filters dropdown lists
            if (data.filters) {
              this.departmentsList = data.filters.departments || [];
              this.subDepartmentsList = data.filters.subDepartments || [];
              this.initializeFilterFields();
            }
          }
        })
    );
  }

  get activeChips(): { key: string; label: string }[] {
    const chips: { key: string; label: string }[] = [];
    if (this.searchTerm) chips.push({ key: 'searchTerm', label: `Keyword: ${this.searchTerm}` });
    if (this.requestTypeFilter) chips.push({ key: 'requestTypeFilter', label: `Type: ${this.requestTypeFilter}` });
    if (this.statusFilter) chips.push({ key: 'statusFilter', label: `Status: ${this.statusFilter}` });
    if (this.priorityFilter) chips.push({ key: 'priorityFilter', label: `Priority: ${this.priorityFilter}` });
    if (this.taskTypeFilter) chips.push({ key: 'taskTypeFilter', label: `Task: ${this.taskTypeFilter}` });
    if (this.hasProofFilter !== '') chips.push({ key: 'hasProofFilter', label: `Has Proof: ${this.hasProofFilter === 'true' ? 'Yes' : 'No'}` });
    if (this.departmentIdFilter) {
      const d = this.departmentsList.find(dept => dept.id.toString() === this.departmentIdFilter.toString());
      chips.push({ key: 'departmentIdFilter', label: `Dept: ${d ? d.name : this.departmentIdFilter}` });
    }
    if (this.subDepartmentIdFilter) {
      const s = this.subDepartmentsList.find(sub => sub.id.toString() === this.subDepartmentIdFilter.toString());
      chips.push({ key: 'subDepartmentIdFilter', label: `Sub-Dept: ${s ? s.name : this.subDepartmentIdFilter}` });
    }
    if (this.onlyActionableRequestsFilter === 'true') chips.push({ key: 'onlyActionableRequestsFilter', label: 'Actionable by Me' });
    if (this.onlyMyRequestsFilter === 'true') chips.push({ key: 'onlyMyRequestsFilter', label: 'My Requests Only' });
    return chips;
  }

  removeChip(key: string): void {
    if (key === 'searchTerm') this.searchTerm = '';
    else if (key === 'requestTypeFilter') this.requestTypeFilter = '';
    else if (key === 'statusFilter') this.statusFilter = '';
    else if (key === 'priorityFilter') this.priorityFilter = '';
    else if (key === 'taskTypeFilter') this.taskTypeFilter = '';
    else if (key === 'hasProofFilter') this.hasProofFilter = '';
    else if (key === 'departmentIdFilter') this.departmentIdFilter = '';
    else if (key === 'subDepartmentIdFilter') this.subDepartmentIdFilter = '';
    else if (key === 'onlyActionableRequestsFilter') this.onlyActionableRequestsFilter = '';
    else if (key === 'onlyMyRequestsFilter') this.onlyMyRequestsFilter = '';

    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.requestTypeFilter = '';
    this.statusFilter = '';
    this.priorityFilter = '';
    this.taskTypeFilter = '';
    this.hasProofFilter = '';
    this.departmentIdFilter = '';
    this.subDepartmentIdFilter = '';
    this.onlyActionableRequestsFilter = '';
    this.onlyMyRequestsFilter = '';
    this.selectedCard = 'total';
    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  onToolbarSearchClear(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  onApplyDrawerFilters(newValues: { [key: string]: any }): void {
    this.searchTerm = newValues['searchTerm'] || '';
    this.requestTypeFilter = newValues['requestTypeFilter'] || '';
    this.statusFilter = newValues['statusFilter'] || '';
    this.priorityFilter = newValues['priorityFilter'] || '';
    this.taskTypeFilter = newValues['taskTypeFilter'] || '';
    this.hasProofFilter = newValues['hasProofFilter'] || '';
    this.departmentIdFilter = newValues['departmentIdFilter'] || '';
    this.subDepartmentIdFilter = newValues['subDepartmentIdFilter'] || '';
    this.onlyActionableRequestsFilter = newValues['onlyActionableRequestsFilter'] || '';
    this.onlyMyRequestsFilter = newValues['onlyMyRequestsFilter'] || '';

    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  selectRequestType(type: string): void {
    if (this.requestTypeFilter === type) {
      this.requestTypeFilter = '';
    } else {
      this.requestTypeFilter = type;
    }
    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  selectRequestStatus(status: string): void {
    if (this.statusFilter === status) {
      this.statusFilter = '';
    } else {
      this.statusFilter = status;
    }
    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  selectCard(cardName: string) {
    switch (cardName) {
      case 'total':
        this.statusFilter = '';
        this.requestTypeFilter = '';
        break;
      case 'pending':
        this.selectRequestStatus('PENDING');
        break;
      case 'approved':
        this.selectRequestStatus('APPROVED');
        break;
      case 'rejected':
        this.selectRequestStatus('REJECTED');
        break;
      case 'closure':
        this.selectRequestType('CLOSURE');
        break;
      case 'extension':
        this.selectRequestType('EXTENSION');
        break;
    }
  }



  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadRequestsFromServer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPageNumbers(): number[] {
    const maxVisiblePages = 5;
    const half = Math.floor(maxVisiblePages / 2);
    let start = Math.max(this.currentPage - half, 1);
    let end = Math.min(start + maxVisiblePages - 1, this.totalPages);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(end - maxVisiblePages + 1, 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  setSort(field: string): void {
    if (this.sortBy === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortDirection = 'desc';
    }
    this.currentPage = 1;
    this.loadRequestsFromServer();
  }

  exportRequests(): void {
    const params: any = {
      search: this.searchTerm,
      departmentId: this.departmentIdFilter,
      subDepartmentId: this.subDepartmentIdFilter,
      requestType: this.requestTypeFilter,
      status: this.statusFilter,
      taskPriority: this.priorityFilter,
      taskType: this.taskTypeFilter,
      hasProof: this.hasProofFilter !== '' ? this.hasProofFilter === 'true' : '',
      onlyPending: this.statusFilter === 'PENDING' ? 'true' : '',
      onlyMyRequests: this.onlyMyRequestsFilter === 'true' ? 'true' : '',
      onlyActionableRequests: this.onlyActionableRequestsFilter === 'true' ? 'true' : ''
    };

    this.requestService.exportRequests(params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-requests-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Failed to export requests', err);
      }
    });
  }

  // Lazy detail retrieval
  viewRequestDetails(request: any): void {
    this.loadingDetail = true;

    this.requestService.getRequestById(request.requestId).subscribe({
      next: (res) => {
        this.loadingDetail = false;
        if (res?.success && res.data) {
          this.activeRequestDetail = res.data;
        }
      },
      error: (err) => {
        this.loadingDetail = false;
        console.error('Failed to load request details', err);
      }
    });
  }

  closeDetailModal(): void {
    this.activeRequestDetail = null;
  }

  // Direct Action triggers
  openApproveDialog(request: any, event: Event): void {
    event.stopPropagation();
    this.approveDialog = {
      isOpen: true,
      requestId: request.requestId,
      requestType: request.requestType,
      remarks: '',
      newDueDate: ''
    };
  }

  closeApproveDialog(): void {
    this.approveDialog.isOpen = false;
  }

  submitApprove(): void {
    if (!this.approveDialog.requestId) return;

    const payload: any = {
      requestId: this.approveDialog.requestId,
      remarks: this.approveDialog.remarks
    };

    if (this.approveDialog.requestType === 'EXTENSION' && this.approveDialog.newDueDate) {
      payload.newDueDate = this.approveDialog.newDueDate;
    }

    this.loading = true;
    this.requestService.approveRequestDirect(this.approveDialog.requestId, payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.closeApproveDialog();
        this.loadRequestsFromServer();
      },
      error: (err) => {
        this.loading = false;
        alert(err?.error?.message || 'Failed to approve request');
      }
    });
  }

  openRejectDialog(request: any, event: Event): void {
    event.stopPropagation();
    this.rejectDialog = {
      isOpen: true,
      requestId: request.requestId,
      reason: ''
    };
  }

  closeRejectDialog(): void {
    this.rejectDialog.isOpen = false;
  }

  submitReject(): void {
    if (!this.rejectDialog.requestId) return;
    if (!this.rejectDialog.reason.trim()) {
      alert('Remarks/rejection reason is required.');
      return;
    }

    const payload = {
      requestId: this.rejectDialog.requestId,
      reason: this.rejectDialog.reason
    };

    this.loading = true;
    this.requestService.rejectRequestDirect(this.rejectDialog.requestId, payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.closeRejectDialog();
        this.loadRequestsFromServer();
      },
      error: (err) => {
        this.loading = false;
        alert(err?.error?.message || 'Failed to reject request');
      }
    });
  }

  deleteRequestDirect(request: any, event: Event): void {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete Request ID: ${request.requestId}?`)) {
      this.loading = true;
      this.requestService.deleteRequest(request.requestId).subscribe({
        next: () => {
          this.loading = false;
          this.loadRequestsFromServer();
        },
        error: (err) => {
          this.loading = false;
          alert(err?.error?.message || 'Failed to delete request');
        }
      });
    }
  }

  getTypeBadge(type: string): { text: string; icon: string } {
    return type === 'EXTENSION'
      ? { text: 'Extension Request', icon: 'bi-clock-history' }
      : { text: 'Closure Request', icon: 'bi-lock-fill' };
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-warning text-dark';
      case 'APPROVED': return 'bg-success text-white';
      case 'REJECTED': return 'bg-danger text-white';
      default: return 'bg-secondary text-white';
    }
  }

  hasPermission(perm: string): boolean {
    return this.authApiService.hasPermission(perm);
  }

  goBackToDashboard(): void {
    this.location.back();
  }
}