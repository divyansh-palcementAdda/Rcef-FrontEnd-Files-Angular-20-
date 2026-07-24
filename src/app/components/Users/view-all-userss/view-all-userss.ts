import { Component, OnInit, inject, HostListener, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { userDto } from '../../../Model/userDto';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../Services/UserApiService';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { Department } from '../../../Model/department';
import { ApiService } from '../../../Services/api-service';
import { SubjectApiService } from '../../../Services/subject-api.service';
import { forkJoin, Observable, of, Subject, switchMap } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalService } from '../../../Services/modal-service';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';
import { ToastService } from '../../../Services/ToastData';
import { EditUser } from '../edit-user/edit-user';
import { FilterFieldConfig } from '../../Shared/filter-drawer/filter-drawer.component';
import { UsersImportComponent } from '../users-import/users-import';

@Component({
  selector: 'app-view-all-users',
  templateUrl: './view-all-userss.html',
  styleUrls: ['./view-all-userss.css'],
  imports: [CommonModule, FormsModule, EditUser, UsersImportComponent]
})
export class ViewAllUserss implements OnInit {

  users: userDto[] = [];
  filteredUsers: userDto[] = [];

  errorMessage: string | null = null;
  loading = true;

  // Sorting
  sortBy = 'fullName';
  sortDirection = 'asc';

  // Filter values
  searchTerm = '';
  private _searchTerm$ = new Subject<string>();
  roleFilter = '';
  departmentIdFilter: number | '' = '';
  subDepartmentIdFilter = '';
  subjectIdFilter: number | '' = '';
  statusFilter = '';

  // Dropdown options
  departmentsList: Department[] = [];
  subDepartmentsList: any[] = [];
  subjectsList: any[] = [];
  rolesList: any[] = [];

  // Filter drawer config
  filterFields: FilterFieldConfig[] = [];
  isDrawerOpen = false;

  showBulkUploadModal = false;
  isExportDropdownOpen = false;

  // Stats & breakdown responses
  stats = {
    totalUsers: 0,
    admins: 0,
    subAdmins: 0,
    hods: 0,
    teachers: 0,
    departments: 0,
    subDepartments: 0,
    subjects: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    recentlyAdded: 0,
    emailVerified: 0,
    pendingVerification: 0
  };

  departmentBreakdown: any[] = [];
  roleBreakdown: { [key: string]: number } = {};
  subjectBreakdown: any[] = [];

  selectedCard = 'total';

  // ── Access Control ──────────────────────────────────────────
  showAccessDeniedModal = false;
  // ────────────────────────────────────────────────────────────

  // ── Edit User Modal ─────────────────────────────────────────
  showEditUserModal = false;
  editUserId: number | null = null;

  openEditUserModal(event: Event, userId: number): void {
    event.stopPropagation();
    this.router.navigate([], {
      queryParams: { modal: 'edit-user', id: userId },
      queryParamsHandling: 'merge'
    });
  }

  // ── Add User Modal ──────────────────────────────────────────
  openAddUserModal(): void {
    this.router.navigate([], {
      queryParams: { modal: 'add-user' },
      queryParamsHandling: 'merge'
    });
  }

  closeEditUserModal(saved: boolean): void {
    this.router.navigate([], {
      queryParams: { modal: undefined, id: undefined },
      queryParamsHandling: 'merge'
    });
    this.showEditUserModal = false;
    this.editUserId = null;
    document.body.style.overflow = '';
    if (saved) { this.loadUsersForRole(); }
  }
  // ────────────────────────────────────────────────────────────

  // ── Add User Modal ──────────────────────────────────────────
  showAddUserModal = false;
  addUserLoading = false;
  addUserError: string | null = null;
  addUserSuccess: string | null = null;
  showAddUserPassword = false;
  availableDepartments: Department[] = [];
  totalSubDepartments = 0;

  // OTP
  addUserOtpSent = false;
  addUserOtpValidated = false;
  addUserOtpSending = false;
  addUserOtpInput = '';
  addUserVerifiedEmail: string | null = null;

  // Password strength
  addUserPwdStrength = { score: 0, label: 'None', color: '#dee2e6' };

  // Role list (dynamic)
  addUserRoles: string[] = [];

  // Reporting managers
  addUserEligibleManagers: userDto[] = [];
  addUserShowManagerDrop = false;
  addUserManagerSearch = '';
  private _addUserManagerSearch$ = new Subject<string>();
  _filteredManagers: userDto[] = [];

  // Sub-departments
  addUserSubDepts: any[] = [];
  addUserShowSubDeptDrop = false;

  // Department search
  addUserDeptSearch = '';
  private _addUserDeptSearch$ = new Subject<string>();
  _filteredDepts: Department[] = [];

  // Subjects
  addUserSubjects: any[] = [];
  addUserSelectedSubjectIds: number[] = [];
  addUserSubjectSearch = '';
  addUserShowSubjectDrop = false;
  private _addUserSubjectSearch$ = new Subject<string>();
  _filteredSubjects: any[] = [];

  addUserPayload = {
    fullName: '',
    username: '',
    email: '',
    password: '',
    roleName: '',
    departmentIds: [] as number[],
    subDepartmentIds: [] as string[],
    subDepartmentId: null as string | null,
    reportingManagerIds: [] as number[],
    parentUserId: null as number | null
  };
  // ────────────────────────────────────────────────────────────

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalElements = 0;

  // Role-based data
  private currentUserId!: number;
  currentRole!: string;          // ADMIN | HOD
  private hodSubDepartmentId?: string;   // only for HOD (UUID)

  private destroyRef = inject(DestroyRef);
  private modalService = inject(ModalService);

  constructor(
    private apiService: UserApiService,
    private router: Router,
    private route: ActivatedRoute,
    private authApiService: AuthApiService,
    private jwtService: JwtService,
    private confirmDialog: ConfirmDialogService,
    private toastService: ToastService,
    private departmentApiService: DepartmentApiService,
    private otpApiService: ApiService,
    private subjectApiService: SubjectApiService
  ) {
    this.modalService.modalClosed$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.success) {
        this.updateQueryParams();
      }
    });

    ngOnInit(): void {
      this.searchTerm = '';
      // ── Debounced main search (prevents API call on every keystroke) ──
      this._searchTerm$.pipe(
        takeUntilDestroyed(),
        debounceTime(400),
        distinctUntilChanged()
      ).subscribe(term => {
        this.searchTerm = term;
        this.currentPage = 1;
        this.loadUsersForRole();
      });
    }

    ngOnInit(): void {
      // Load filter dropdown options once on initial startup
      this.loadDropdownOptions();

      this.initCurrentUser()
        .pipe(
          switchMap(() => this.route.queryParams)
        )
        .subscribe(params => {
          if (this.showAccessDeniedModal) return; // Teacher blocked — skip data load

          this.currentPage = params['page'] ? Number(params['page']) : 1;
          this.pageSize = params['pageSize'] ? Number(params['pageSize']) : 10;
          this.sortBy = params['sortBy'] || 'fullName';
          this.sortDirection = params['sortDirection'] || 'asc';
          this.searchTerm = '';
          this.roleFilter = params['role'] || '';
          this.departmentIdFilter = params['department'] ? Number(params['department']) : '';
          this.subDepartmentIdFilter = params['subDepartment'] || '';
          this.subjectIdFilter = params['subject'] ? Number(params['subject']) : '';
          this.statusFilter = params['status'] ? params['status'].toUpperCase() : '';
          this.selectedCard = params['card'] || 'total';

          const requestParams: any = {
            page: this.currentPage - 1,
            size: this.pageSize,
            sortBy: this.sortBy,
            sortDirection: this.sortDirection
          };

          if (this.searchTerm) requestParams.search = this.searchTerm;
          if (this.roleFilter) requestParams.role = this.roleFilter;
          if (this.departmentIdFilter) requestParams.departmentId = this.departmentIdFilter.toString();
          if (this.subDepartmentIdFilter) requestParams.subDepartmentId = this.subDepartmentIdFilter;
          if (this.subjectIdFilter) requestParams.subjectId = this.subjectIdFilter.toString();
          if (this.statusFilter) requestParams.status = this.statusFilter;

          if (this.currentRole === 'HOD' && this.hodSubDepartmentId) {
            requestParams.subDepartmentId = this.hodSubDepartmentId;
            this.subDepartmentIdFilter = this.hodSubDepartmentId;
          }

          return requestParams;
        }),
      filter((params): params is any => params !== null),
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      tap(() => {
        this.loading = true;
        this.errorMessage = null;
      }),
      switchMap(requestParams =>
        this.apiService.searchUsers(requestParams).pipe(
          catchError(err => {
            this.errorMessage = err?.message || 'Failed to search users.';
            this.loading = false;
            return of(null);
          })
        )
      )
      )
      .subscribe(res => {
        if (res && res.success && res.data) {
          const data = res.data;
          this.users = data.content || [];
          this.filteredUsers = this.users;
          this.totalElements = data.pagination?.totalElements ?? 0;
          this.totalPages = data.pagination?.totalPages ?? 1;
          this.currentPage = (data.pagination?.currentPage ?? 0) + 1;

          this.stats = data.stats || this.stats;
          this.departmentBreakdown = data.departmentBreakdown || [];
          this.roleBreakdown = data.roleBreakdown || {};
          this.subjectBreakdown = data.subjectBreakdown || [];
        }
        this.loading = false;
      });
  }

  /** --------------------------------------------------------------
   *  1. Decode JWT → get userId & role
   *  2. If HOD → fetch the user object to read departmentId
   *  ------------------------------------------------------------ */
  private initCurrentUser(): Observable<void> {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return of(void 0);
    }

    const decoded = this.jwtService.decodeToken(token);
    if (!decoded) {
      this.router.navigate(['/login']);
      return of(void 0);
    }

    this.currentUserId = decoded['userId'];
    this.currentRole = this.authApiService.getCurrentRole() ?? '';

    // TEACHER has no access to this page — show 403 modal instead
    if (this.currentRole === 'TEACHER') {
      this.showAccessDeniedModal = true;
      this.loading = false;
      return of(void 0);
    }

    if (this.currentRole === 'HOD') {
      // HOD needs sub-department → fetch full user DTO
      return this.apiService.getUserById(this.currentUserId).pipe(
        switchMap((user: userDto) => {
          // API returns subDepartmentIds as an ARRAY — pick the first one
          if (user.subDepartmentIds && user.subDepartmentIds.length > 0) {
            this.hodSubDepartmentId = user.subDepartmentIds[0];
          } else if (user.subDepartmentId) {
            // fallback to legacy single-string field if present
            this.hodSubDepartmentId = user.subDepartmentId;
          }
          return of(void 0);
        })
      );
    }

    return of(void 0);
  }

  loadDropdownOptions(): void {
    this.departmentApiService.getAllDepartments().subscribe({
      next: (depts) => {
        this.departmentsList = depts || [];
        this.availableDepartments = depts || [];
        this.initializeFilterFields();
      },
      error: (err) => console.error('Failed to load departments', err)
    });

    this.departmentApiService.getAllSubDepartments().subscribe({
      next: (subs) => {
        this.subDepartmentsList = subs || [];
        this.totalSubDepartments = subs?.length ?? 0;
        this.initializeFilterFields();
      },
      error: (err) => console.error('Failed to load sub-departments', err)
    });

    this.subjectApiService.getAllSubjects().subscribe({
      next: (subs) => {
        this.subjectsList = subs || [];
        this.initializeFilterFields();
      },
      error: (err) => console.error('Failed to load subjects', err)
    });

    this.apiService.getAllRoles().subscribe({
      next: (roles) => {
        this.rolesList = roles || [];
        this.initializeFilterFields();
      },
      error: (err) => console.error('Failed to load roles', err)
    });
  }

  initializeFilterFields(): void {
    this.filterFields = [
      { key: 'searchTerm', label: 'Search Keyword', type: 'text', section: 'general', placeholder: 'Enter username, email...' },
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        section: 'general',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' }
        ]
      },
      {
        key: 'roleFilter',
        label: 'User Role',
        type: 'select',
        section: 'general',
        options: (this.rolesList || []).map(r => ({ value: r.name, label: r.displayName || r.name }))
      },
      {
        key: 'departmentIdFilter',
        label: 'Department',
        type: 'select',
        section: 'organization',
        options: (this.departmentsList || []).map(d => ({ value: d.departmentId, label: d.name }))
      },
      {
        key: 'subDepartmentIdFilter',
        label: 'Sub Department',
        type: 'select',
        section: 'organization',
        options: (this.subDepartmentsList || []).map(s => ({ value: s.id, label: s.name }))
      },
      {
        key: 'subjectIdFilter',
        label: 'Subject',
        type: 'select',
        section: 'organization',
        options: (this.subjectsList || []).map(s => ({ value: s.id, label: s.subjectName }))
      }
    ];
  }

  /** --------------------------------------------------------------
   *  Load the correct list depending on role with dynamic filters
   *  ------------------------------------------------------------ */
  loadUsersForRole(): void {
    this.loading = true;
    this.errorMessage = null;

    const params: any = {
      page: this.currentPage - 1,
      size: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection
    };

    if (this.searchTerm) params.search = this.searchTerm;
    if (this.roleFilter) params.role = this.roleFilter;
    if (this.departmentIdFilter) params.departmentId = this.departmentIdFilter.toString();
    if (this.subDepartmentIdFilter) params.subDepartmentId = this.subDepartmentIdFilter;
    if (this.subjectIdFilter) params.subjectId = this.subjectIdFilter.toString();
    if (this.statusFilter) params.status = this.statusFilter;

    // Enforcement of HOD dynamic RBAC filtering
    if (this.currentRole === 'HOD' && this.hodSubDepartmentId) {
      params.subDepartmentId = this.hodSubDepartmentId;
      this.subDepartmentIdFilter = this.hodSubDepartmentId;
    }

    this.apiService.searchUsers(params).subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          const data = res.data;
          this.users = data.content || [];
          this.filteredUsers = this.users;
          this.totalElements = data.pagination?.totalElements ?? 0;
          this.totalPages = data.pagination?.totalPages ?? 1;
          this.currentPage = (data.pagination?.currentPage ?? 0) + 1;

          this.stats = data.stats || this.stats;
          this.departmentBreakdown = data.departmentBreakdown || [];
          this.roleBreakdown = data.roleBreakdown || {};
          this.subjectBreakdown = data.subjectBreakdown || [];
        }
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = err?.message || 'Failed to search users.';
        this.loading = false;
      }
    });
  }

  /** Called from the search input — debounced via Subject */
  onSearchInput(): void {
    this._searchTerm$.next(this.searchTerm);
  }

  toggleExportDropdown(event?: Event): void {
    event?.stopPropagation();
    this.isExportDropdownOpen = !this.isExportDropdownOpen;
  }

  closeExportDropdown(): void {
    this.isExportDropdownOpen = false;
  }

  /** Apply filters immediately (status, role, dept changes) */
  applyFilters(): void {
    this.currentPage = 1;
    this.updateQueryParams();
  }

  /** Reset filters */
  resetFilters(): void {
    this.searchTerm = '';
    this.roleFilter = '';
    this.departmentIdFilter = '';
    this.subDepartmentIdFilter = '';
    this.subjectIdFilter = '';
    this.statusFilter = '';
    this.selectedCard = 'total';
    this.currentPage = 1;
    this.updateQueryParams();
  }

  // Handle click on stats card to filter the list
  selectCard(cardType: string): void {
    this.selectedCard = cardType;
    this.currentPage = 1;

    // Reset temporary filters
    this.roleFilter = '';
    this.statusFilter = '';

    if (cardType === 'admins') {
      this.roleFilter = 'ADMIN';
    } else if (cardType === 'subadmins') {
      this.roleFilter = 'SUB_ADMIN';
    } else if (cardType === 'hods') {
      this.roleFilter = 'HOD';
    } else if (cardType === 'teachers') {
      this.roleFilter = 'TEACHER';
    } else if (cardType === 'active') {
      this.statusFilter = 'ACTIVE';
    } else if (cardType === 'inactive') {
      this.statusFilter = 'INACTIVE';
    }

    this.updateQueryParams();
  }

  // Handle click on department breakdown card to filter
  selectDepartment(deptId: number): void {
    this.departmentIdFilter = deptId;
    this.currentPage = 1;
    this.updateQueryParams();
  }

  // Handle sort direction and column
  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.updateQueryParams();
  }

  // Drawer events
  toggleDrawer(): void {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  onDrawerApply(values: any): void {
    this.searchTerm = values.searchTerm || '';
    this.statusFilter = values.statusFilter || '';
    this.roleFilter = values.roleFilter || '';
    this.departmentIdFilter = values.departmentIdFilter || '';
    this.subDepartmentIdFilter = values.subDepartmentIdFilter || '';
    this.subjectIdFilter = values.subjectIdFilter || '';
    this.currentPage = 1;
    this.updateQueryParams();
  }

  onDrawerReset(): void {
    this.resetFilters();
  }

  /** TrackBy for table performance */
  trackByUserId(_: number, user: userDto): number { return user.userId; }

  /** Pagination: safe upper bound for display */
  pageUpperBound(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalElements);
  }

  /** Active filter chips (mirrors Task Management pattern) */
  get activeChips(): Array<{ key: string; label: string }> {
    const chips: Array<{ key: string; label: string }> = [];
    if (this.searchTerm) chips.push({ key: 'search', label: `Search: "${this.searchTerm}"` });
    if (this.statusFilter) chips.push({ key: 'status', label: `Status: ${this.statusFilter}` });
    if (this.roleFilter) chips.push({ key: 'role', label: `Role: ${this.roleFilter}` });
    if (this.departmentIdFilter) {
      const d = this.departmentsList.find(x => x.departmentId === Number(this.departmentIdFilter));
      chips.push({ key: 'department', label: `Dept: ${d ? d.name : this.departmentIdFilter}` });
    }
    if (this.subDepartmentIdFilter) {
      const s = this.subDepartmentsList.find(x => x.id === this.subDepartmentIdFilter);
      chips.push({ key: 'subDepartment', label: `Sub-Dept: ${s ? s.name : this.subDepartmentIdFilter}` });
    }
    if (this.subjectIdFilter) {
      const sub = this.subjectsList.find(x => x.id === Number(this.subjectIdFilter));
      chips.push({ key: 'subject', label: `Subject: ${sub ? sub.subjectName : this.subjectIdFilter}` });
    }
    return chips;
  }

  /** Current filter values snapshot for the drawer */
  get filterValues(): { [key: string]: any } {
    return {
      searchTerm: this.searchTerm,
      statusFilter: this.statusFilter,
      roleFilter: this.roleFilter,
      departmentIdFilter: this.departmentIdFilter,
      subDepartmentIdFilter: this.subDepartmentIdFilter,
      subjectIdFilter: this.subjectIdFilter
    };
  }

  /** Remove a single chip and reload */
  removeChip(key: string): void {
    switch (key) {
      case 'search': this.searchTerm = ''; break;
      case 'status': this.statusFilter = ''; this.selectedCard = 'total'; break;
      case 'role': this.roleFilter = ''; break;
      case 'department': this.departmentIdFilter = ''; break;
      case 'subDepartment': this.subDepartmentIdFilter = ''; break;
      case 'subject': this.subjectIdFilter = ''; break;
    }
    this.currentPage = 1;
    this.loadUsersForRole();
  }

  /** Toolbar search with debounce-like direct apply */
  onToolbarSearch(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.updateQueryParams();
  }

  onToolbarSearchClear(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.updateQueryParams();
  }

  /** Role-wise user count helpers */
  get adminCount(): number { return this.stats.admins; }
  get subAdminCount(): number { return this.stats.subAdmins; }
  get hodCount(): number { return this.stats.hods; }
  get teacherCount(): number { return this.stats.teachers; }

  /** Department-wise user breakdown */
  get deptUserBreakdown(): any[] {
    return this.departmentBreakdown.map(d => ({
      name: d.departmentName,
      count: d.totalUsers,
      active: d.active,
      inactive: d.inactive,
      departmentId: d.departmentId
    }));
  }

  /** Change pagination page */
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updateQueryParams();
    }
  }

  updateQueryParams(): void {
    const queryParams: any = {
      page: this.currentPage,
      pageSize: this.pageSize,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
      search: this.searchTerm || null,
      role: this.roleFilter || null,
      department: this.departmentIdFilter || null,
      subDepartment: this.subDepartmentIdFilter || null,
      subject: this.subjectIdFilter || null,
      status: this.statusFilter || null,
      card: this.selectedCard !== 'total' ? this.selectedCard : null
    };

    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === null || queryParams[key] === undefined || queryParams[key] === '') {
        delete queryParams[key];
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  exportUsers(format: string): void {
    this.closeExportDropdown();
    const params = {
      format,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
      search: this.searchTerm,
      role: this.roleFilter,
      departmentId: this.departmentIdFilter,
      subDepartmentId: this.subDepartmentIdFilter,
      subjectId: this.subjectIdFilter,
      status: this.statusFilter
    };

    this.apiService.downloadExportUsers(params).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `users-export-${today}.${format === 'CSV' ? 'csv' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      },
      error: (err: any) => {
        this.errorMessage = err?.message || err?.error?.message || 'Failed to export users.';
      }
    });
  }

  /** Handle page click with type safety */
  onPageClick(page: number | string): void {
    if (typeof page === 'number') {
      this.changePage(page);
    }
  }

  /** Generate array of page numbers for pagination with ellipsis */
  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    const maxVisible = 3;

    if (this.totalPages <= maxVisible) {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    if (this.currentPage <= 2) {
      pages.push(1, 2, 3, '...', this.totalPages);
    } else if (this.currentPage >= this.totalPages - 1) {
      pages.push(1, '...', this.totalPages - 2, this.totalPages - 1, this.totalPages);
    } else {
      pages.push(1, '...', this.currentPage, '...', this.totalPages);
    }

    return pages;
  }

  get paginatedUsers(): userDto[] {
    return this.users;
  }

  goToUser(userId: number): void {
    this.router.navigate(['/user', userId]);
  }

  viewUser(event: Event, userId: number): void {
    event.stopPropagation();
    this.router.navigate(['/user', userId]);
  }

  /** Get paginated users for current page */


  /** Navigate to user details page */


  /** View user (button click) */

  /** Edit user (button click) */
  editUser(event: Event, userId: number): void {
    event.stopPropagation();
    this.router.navigate(['/user/edit', userId]);
  }

  deleteUser(event: Event, userId: number): void {
    event.stopPropagation();

    this.confirmDialog.confirm({
      title: 'Deactivate User',
      message: 'Are you sure you want to deactivate this user?',
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      type: 'danger'
    }).then(confirmed => {

      if (!confirmed) return;

      this.apiService.deleteUser(userId).subscribe({
        next: () => {
          this.users = this.users.filter(u => u.userId !== userId);
          this.applyFilters();
        },
        error: (err: any) => {
          this.errorMessage =
            err?.error?.message || 'Failed to deactivate user.';
        }
      });

    });
  }

  activateUser(event: Event, userId: number): void {
    event.stopPropagation();

    this.confirmDialog.confirm({
      title: 'Activate User',
      message: 'Are you sure you want to activate this user?',
      confirmText: 'Activate',
      cancelText: 'Cancel',
      type: 'info'
    }).then(confirmed => {

      if (!confirmed) return;

      this.apiService.toggleUserStatus(userId).subscribe({
        next: () => {
          const user = this.users.find(u => u.userId === userId);

          if (user) {
            user.status = 'ACTIVE';
          }

          this.applyFilters();
        },
        error: (err: any) => {
          this.errorMessage =
            err?.error?.message || 'Failed to activate user.';
        }
      });

    });
  }

  // ── Add User Modal Methods ───────────────────────────────────

  _deprecated_openAddUserModal(): void {
    this.addUserPayload = {
      fullName: '', username: '', email: '', password: '', roleName: '',
      departmentIds: [], subDepartmentIds: [], subDepartmentId: null,
      reportingManagerIds: [], parentUserId: null
    };
    this.addUserError = null;
    this.addUserSuccess = null;
    this.showAddUserPassword = false;
    this.addUserOtpSent = false;
    this.addUserOtpValidated = false;
    this.addUserOtpInput = '';
    this.addUserVerifiedEmail = null;
    this.addUserPwdStrength = { score: 0, label: 'None', color: '#dee2e6' };
    this.addUserEligibleManagers = [];
    this._rebuildFilteredManagers();
    this.addUserSubDepts = [];
    this.addUserShowManagerDrop = false;
    this.addUserShowSubDeptDrop = false;
    this.addUserDeptSearch = '';
    this.addUserManagerSearch = '';
    this.addUserSubjects = [];
    this._rebuildFilteredSubjects();
    this.addUserSelectedSubjectIds = [];
    this.addUserSubjectSearch = '';
    this.addUserShowSubjectDrop = false;
    this.showAddUserModal = true;
    document.body.style.overflow = 'hidden';

    // Build roles list based on current user role
    const allRoles = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HOD', 'TEACHER'];
    const idx = allRoles.indexOf(this.currentRole);
    this.addUserRoles = idx !== -1 ? allRoles.slice(idx + 1) : ['HOD', 'TEACHER'];

    // Load departments (already pre-loaded on init, refresh if empty)
    if (this.availableDepartments.length === 0) {
      this.departmentApiService.getAllDepartments().subscribe({
        next: (depts) => { this.availableDepartments = depts; this._rebuildFilteredDepts(); },
        error: () => { }
      });
    } else {
      this._rebuildFilteredDepts();
    }
  }

  closeAddUserModal(): void {
    this.showAddUserModal = false;
    this.addUserError = null;
    this.addUserSuccess = null;
    this.addUserShowManagerDrop = false;
    this.addUserShowSubDeptDrop = false;
    document.body.style.overflow = '';
  }

  sendAddUserOtp(): void {
    if (!this.addUserPayload.email) {
      this.addUserError = 'Please enter an email first.';
      return;
    }
    this.addUserOtpSending = true;
    this.addUserError = null;
    this.otpApiService.sendOtp({ email: this.addUserPayload.email }).subscribe({
      next: (res: any) => {
        this.addUserOtpSending = false;
        if (res.success || res.status === 'OTP_SENT') {
          this.addUserOtpSent = true;
          this.addUserSuccess = res.message || 'OTP sent to email.';
        }
      },
      error: (err: any) => {
        this.addUserOtpSending = false;
        this.addUserError = err?.error?.message || 'Failed to send OTP.';
      }
    });
  }

  verifyAddUserOtp(): void {
    if (!this.addUserOtpInput) {
      this.addUserError = 'Please enter the OTP.';
      return;
    }
    this.otpApiService.validateOtp({ email: this.addUserPayload.email, otp: this.addUserOtpInput }).subscribe({
      next: () => {
        this.addUserOtpValidated = true;
        this.addUserVerifiedEmail = this.addUserPayload.email;
        this.addUserSuccess = 'Email verified successfully!';
        this.addUserError = null;
      },
      error: (err: any) => {
        this.addUserError = err?.error?.message || 'Invalid OTP.';
      }
    });
  }

  onAddUserPasswordChange(value: string): void {
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[a-z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[@#$%^&+=!]/.test(value)) score++;
    if (score <= 1) this.addUserPwdStrength = { score: 20, label: 'Very Weak', color: '#e74a3b' };
    else if (score === 2) this.addUserPwdStrength = { score: 40, label: 'Weak', color: '#e74a3b' };
    else if (score === 3) this.addUserPwdStrength = { score: 60, label: 'Medium', color: '#f6c23e' };
    else if (score === 4) this.addUserPwdStrength = { score: 80, label: 'Strong', color: '#1cc88a' };
    else this.addUserPwdStrength = { score: 100, label: 'Very Strong', color: '#1cc88a' };
  }

  onAddUserRoleChange(role: string): void {
    this.addUserPayload.reportingManagerIds = [];
    this.addUserPayload.parentUserId = null;
    this.addUserEligibleManagers = [];
    this.addUserSubDepts = [];
    this.addUserPayload.subDepartmentIds = [];
    this.addUserPayload.subDepartmentId = null;

    if (role && role !== 'SUPER_ADMIN') {
      this.apiService.getEligibleManagers(role).subscribe({
        next: (managers) => { this.addUserEligibleManagers = managers; this._rebuildFilteredManagers(); },
        error: () => { }
      });
    }

    // Reload sub-depts based on already selected departments
    if (this.addUserPayload.departmentIds.length > 0) {
      this.reloadAddUserSubDepts();
    }
  }

  toggleAddUserDept(event: any, deptId: number): void {
    const role = this.addUserPayload.roleName;
    if (event.target.checked) {
      if (role === 'HOD' || role === 'SUB_ADMIN') {
        this.addUserPayload.departmentIds = [deptId];
      } else {
        if (!this.addUserPayload.departmentIds.includes(deptId)) {
          this.addUserPayload.departmentIds = [...this.addUserPayload.departmentIds, deptId];
        }
      }
    } else {
      this.addUserPayload.departmentIds = this.addUserPayload.departmentIds.filter(id => id !== deptId);
    }
    this.reloadAddUserSubDepts();
  }

  isAddUserDeptDisabled(deptId: number): boolean {
    const role = this.addUserPayload.roleName;
    if ((role === 'HOD' || role === 'SUB_ADMIN') &&
      this.addUserPayload.departmentIds.length >= 1 &&
      !this.addUserPayload.departmentIds.includes(deptId)) {
      return true;
    }
    return false;
  }

  filteredAddUserDepts(): Department[] {
    return this._filteredDepts;
  }

  /** Call whenever availableDepartments or addUserDeptSearch changes */
  private _rebuildFilteredDepts(): void {
    const q = this.addUserDeptSearch.toLowerCase().trim();
    this._filteredDepts = q
      ? this.availableDepartments.filter(d => d.name.toLowerCase().includes(q))
      : [...this.availableDepartments];
  }

  onAddUserDeptSearchChange(val: string): void {
    this.addUserDeptSearch = val;
    this._addUserDeptSearch$.next(val);
  }

  reloadAddUserSubDepts(): void {
    if (this.addUserPayload.departmentIds.length === 0) {
      this.addUserSubDepts = [];
      this.addUserSubjects = [];
      this._rebuildFilteredSubjects();
      this.addUserSelectedSubjectIds = [];
      return;
    }
    const reqs = this.addUserPayload.departmentIds.map(id =>
      this.departmentApiService.getSubDepartmentsByDepartment(id)
    );
    forkJoin(reqs).subscribe({
      next: (results) => {
        const flat = results.flat();
        // Normalize: ensure every entry has `.id` field (API may return subDepartmentId)
        this.addUserSubDepts = flat.map(s => ({
          ...s,
          id: s.id ?? s.subDepartmentId
        }));
        // If no sub-dept selected yet, load subjects by department
        if (this.addUserPayload.subDepartmentIds.length === 0) {
          this.reloadAddUserSubjects();
        }
      },
      error: () => { }
    });
  }

  toggleAddUserSubDept(id: string, event: Event): void {
    event.preventDefault(); event.stopPropagation();
    const ids = this.addUserPayload.subDepartmentIds;
    if (ids.includes(id)) {
      this.addUserPayload.subDepartmentIds = ids.filter(x => x !== id);
    } else {
      this.addUserPayload.subDepartmentIds = [...ids, id];
    }
    this.addUserPayload.subDepartmentId = this.addUserPayload.subDepartmentIds[0] ?? null;
    this.reloadAddUserSubjects();
  }

  removeAddUserSubDept(id: string, event: Event): void {
    event.preventDefault(); event.stopPropagation();
    this.addUserPayload.subDepartmentIds = this.addUserPayload.subDepartmentIds.filter(x => x !== id);
    this.addUserPayload.subDepartmentId = this.addUserPayload.subDepartmentIds[0] ?? null;
    this.reloadAddUserSubjects();
  }

  getAddUserSubDeptName(id: string): string {
    const s = this.addUserSubDepts.find(x => x.id === id);
    return s ? s.name : id;
  }

  filteredAddUserManagers(): userDto[] {
    return this._filteredManagers;
  }

  /** Call whenever addUserEligibleManagers or addUserManagerSearch changes */
  private _rebuildFilteredManagers(): void {
    const q = this.addUserManagerSearch.toLowerCase().trim();
    this._filteredManagers = q
      ? this.addUserEligibleManagers.filter(u =>
        u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
      : [...this.addUserEligibleManagers];
  }

  onAddUserManagerSearchChange(val: string): void {
    this.addUserManagerSearch = val;
    this._addUserManagerSearch$.next(val);
  }

  toggleAddUserManager(id: number, event: Event): void {
    event.preventDefault(); event.stopPropagation();
    const ids = this.addUserPayload.reportingManagerIds;
    if (ids.includes(id)) {
      this.addUserPayload.reportingManagerIds = ids.filter(x => x !== id);
    } else {
      this.addUserPayload.reportingManagerIds = [...ids, id];
    }
    this.addUserPayload.parentUserId = this.addUserPayload.reportingManagerIds[0] ?? null;
    this.addUserShowManagerDrop = true;
  }

  removeAddUserManager(id: number, event: Event): void {
    event.preventDefault(); event.stopPropagation();
    this.addUserPayload.reportingManagerIds = this.addUserPayload.reportingManagerIds.filter(x => x !== id);
    this.addUserPayload.parentUserId = this.addUserPayload.reportingManagerIds[0] ?? null;
  }

  getAddUserManagerName(id: number): string {
    const m = this.addUserEligibleManagers.find(u => u.userId === id);
    return m ? m.fullName : `#${id}`;
  }

  // ── Subject helpers ──────────────────────────────────────────
  reloadAddUserSubjects(): void {
    const subDeptIds = this.addUserPayload.subDepartmentIds;
    const deptIds = this.addUserPayload.departmentIds;
    // Use first selected sub-dept (same as original add-user: subDepartmentId = first)
    const subDeptId = subDeptIds.length > 0 ? subDeptIds[0] : null;

    if (!subDeptId && deptIds.length === 0) {
      this.addUserSubjects = [];
      this._rebuildFilteredSubjects();
      this.addUserSelectedSubjectIds = [];
      return;
    }

    if (subDeptId) {
      // Load by sub-department — exact same as original: getSubjects(null, subDeptId)
      this.subjectApiService.getSubjects(null, subDeptId).subscribe({
        next: (subs) => {
          this.addUserSubjects = subs;
          this._rebuildFilteredSubjects();
          // Remove selected subjects no longer valid
          this.addUserSelectedSubjectIds = this.addUserSelectedSubjectIds.filter(
            id => subs.some((s: any) => s.id === id)
          );
        },
        error: () => { }
      });
    } else if (deptIds.length > 0) {
      // Fallback: load by departments
      const reqs = deptIds.map(id => this.subjectApiService.getSubjects(id, null));
      forkJoin(reqs).subscribe({
        next: (results) => {
          const merged = results.flat();
          const unique = merged.filter((s, i, arr) => arr.findIndex((x: any) => x.id === s.id) === i);
          this.addUserSubjects = unique;
          this._rebuildFilteredSubjects();
          this.addUserSelectedSubjectIds = this.addUserSelectedSubjectIds.filter(
            id => unique.some((s: any) => s.id === id)
          );
        },
        error: () => { }
      });
    }
  }

  filteredAddUserSubjects(): any[] {
    return this._filteredSubjects;
  }

  /** Call whenever addUserSubjects or addUserSubjectSearch changes */
  private _rebuildFilteredSubjects(): void {
    const q = this.addUserSubjectSearch.toLowerCase().trim();
    this._filteredSubjects = q
      ? this.addUserSubjects.filter(s =>
        s.subjectName?.toLowerCase().includes(q) || s.subjectCode?.toLowerCase().includes(q))
      : [...this.addUserSubjects];
  }

  onAddUserSubjectSearchChange(val: string): void {
    this.addUserSubjectSearch = val;
    this._addUserSubjectSearch$.next(val);
  }

  toggleAddUserSubject(id: number, event: Event): void {
    event.preventDefault(); event.stopPropagation();
    if (this.addUserSelectedSubjectIds.includes(id)) {
      this.addUserSelectedSubjectIds = this.addUserSelectedSubjectIds.filter(x => x !== id);
    } else {
      this.addUserSelectedSubjectIds = [...this.addUserSelectedSubjectIds, id];
    }
  }

  removeAddUserSubject(id: number, event: Event): void {
    event.preventDefault(); event.stopPropagation();
    this.addUserSelectedSubjectIds = this.addUserSelectedSubjectIds.filter(x => x !== id);
  }

  getAddUserSubjectName(id: number): string {
    const s = this.addUserSubjects.find(x => x.id === id);
    return s ? s.subjectName : `#${id}`;
  }
  // ─────────────────────────────────────────────────────────────

  submitAddUser(): void {
    if (!this.addUserOtpValidated) {
      this.addUserError = 'Please verify email with OTP first.';
      return;
    }
    if (!this.addUserPayload.fullName.trim() || !this.addUserPayload.username.trim() ||
      !this.addUserPayload.password || !this.addUserPayload.roleName) {
      this.addUserError = 'Please fill all required fields.';
      return;
    }

    this.addUserLoading = true;
    this.addUserError = null;

    const payload: Record<string, any> = {
      fullName: this.addUserPayload.fullName.trim(),
      username: this.addUserPayload.username.trim(),
      email: this.addUserVerifiedEmail,
      password: this.addUserPayload.password,
      role: this.addUserPayload.roleName,          // ← backend expects "role"
      roleName: this.addUserPayload.roleName,       // ← send both for compatibility
      departmentIds: this.addUserPayload.departmentIds,
      subDepartmentIds: this.addUserPayload.subDepartmentIds,
      subDepartmentId: this.addUserPayload.subDepartmentId,
      reportingManagerIds: this.addUserPayload.reportingManagerIds,
      parentUserId: this.addUserPayload.parentUserId,
      subjectIds: this.addUserSelectedSubjectIds
    };

    this.apiService.createUser(payload).subscribe({
      next: () => {
        this.addUserLoading = false;
        this.closeAddUserModal();
        this.toastService.show({ title: 'Success', message: `User "${payload['fullName']}" created successfully.` });
        this.loadUsersForRole();
      },
      error: (err: any) => {
        this.addUserLoading = false;
        this.addUserError = err?.message || err?.error?.message || 'Failed to create user. Please try again.';
      }
    });
  }

  // ─────────────────────────────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-multiselect-container')) {
      this.addUserShowManagerDrop = false;
      this.addUserShowSubDeptDrop = false;
      this.addUserShowSubjectDrop = false;
    }
    if (!target.closest('.export-dropdown-wrap')) {
      this.isExportDropdownOpen = false;
    }
  }

  /** Called by modal-body click — closes all dropdowns unless click was inside one */
  closeAllDropdowns(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-multiselect-container')) {
      this.addUserShowManagerDrop = false;
      this.addUserShowSubDeptDrop = false;
      this.addUserShowSubjectDrop = false;
    }
  }

  goBackToDashboard() {
    const token = this.jwtService.getAccessToken();
    if (token) {
      const payload = this.jwtService.decodeToken(token);
      this.authApiService.goToDashboard();
    } else {
      this.router.navigate(['/login']);
    }
  }

  goToBulkImport(): void {
    this.showBulkUploadModal = true;
  }

  closeBulkUploadModal(): void {
    this.showBulkUploadModal = false;
    // Optionally refresh users list if needed
    // this.loadUsers(); 
  }

  hasPermission(permission: string): boolean {
    return this.authApiService.hasPermission(permission);
  }

  downloadTemplate(): void {
    this.apiService.downloadImportTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.toastService.show({
          title: 'Success',
          message: 'Template downloaded successfully'
        });
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Failed to download template.';
      }
    });
  }
}




