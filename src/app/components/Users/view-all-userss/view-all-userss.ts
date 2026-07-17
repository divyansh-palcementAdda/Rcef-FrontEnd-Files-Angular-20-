// view-all-userss.component.ts
import { Component, OnInit, inject, HostListener } from '@angular/core';
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
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalService } from '../../../Services/modal-service';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';
import { ToastService } from '../../../Services/ToastData';
import { EditUser } from '../edit-user/edit-user';

@Component({
  selector: 'app-view-all-users',
  templateUrl: './view-all-userss.html',
  styleUrls: ['./view-all-userss.css'],
  imports: [CommonModule, FormsModule, EditUser]
})
export class ViewAllUserss implements OnInit {

  users: userDto[] = [];
  filteredUsers: userDto[] = [];

  errorMessage: string | null = null;
  loading = true;

  // ── Edit User Modal ─────────────────────────────────────────
  showEditUserModal = false;
  editUserId: number | null = null;

  openEditUserModal(event: Event, userId: number): void {
    event.stopPropagation();
    this.editUserId = userId;
    this.showEditUserModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeEditUserModal(saved: boolean): void {
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

  // Sub-departments
  addUserSubDepts: any[] = [];
  addUserShowSubDeptDrop = false;

  // Department search
  addUserDeptSearch = '';

  // Subjects
  addUserSubjects: any[] = [];
  addUserSelectedSubjectIds: number[] = [];
  addUserSubjectSearch = '';
  addUserShowSubjectDrop = false;

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

  // Filters
  searchTerm = '';
  statusFilter = '';

  // Role-based data
  private currentUserId!: number;
  currentRole!: string;          // ADMIN | HOD
  private hodSubDepartmentId?: string;   // only for HOD (UUID)

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
        this.loadUsersForRole();
      }
    });
  }

  ngOnInit(): void {
    this.initCurrentUser()
      .pipe(
        switchMap(() => this.route.queryParams)
      )
      .subscribe(params => {
        const status = params['status'];
        this.statusFilter = status ? status.toUpperCase() : '';
        this.loadUsersForRole();
      });

    // Load departments & sub-departments for stats cards
    this.departmentApiService.getAllDepartments().subscribe({
      next: (depts) => { this.availableDepartments = depts; },
      error: () => {}
    });
    this.departmentApiService.getAllSubDepartments().subscribe({
      next: (subs) => { this.totalSubDepartments = subs?.length ?? 0; },
      error: () => {}
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

  /** --------------------------------------------------------------
   *  Load the correct list depending on role
   *  ------------------------------------------------------------ */
  private loadUsersForRole(): void {
    this.loading = true;
    this.errorMessage = null;

    let obs$: Observable<userDto[]>;

    if (this.currentRole === 'SUPER_ADMIN' || this.currentRole === 'ADMIN' || this.currentRole === 'SUB_ADMIN' || this.currentRole === 'TEACHER') {
      obs$ = this.statusFilter
        ? this.apiService.getAllUsersByStatus(this.statusFilter)
        : this.apiService.getAllUsers();
    } else if (this.currentRole === 'HOD') {
      if (this.hodSubDepartmentId) {
        // Simply fetch all users in the HOD's sub-department
        obs$ = this.apiService.getAllUsersBySubDepartment(this.hodSubDepartmentId);
      } else {
        this.errorMessage = 'Missing sub-department assignment for HOD.';
        this.loading = false;
        return;
      }
    } else {
      this.errorMessage = 'Invalid role or access denied.';
      this.loading = false;
      return;
    }

    obs$.subscribe({
      next: (users) => {
        this.users = users ?? [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = err?.error?.message || 'Failed to load users.';
        this.loading = false;
      }
    });
  }

  /* ----------------------------------------------------------------
   *  The rest of the component stays **exactly the same** (filters,
   *  pagination, delete, edit, view …)
   * ---------------------------------------------------------------- */
  /** Apply search and status filters */
  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = !this.searchTerm ||
        user.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.departmentNames.some(name =>
          name.toLowerCase().includes(this.searchTerm.toLowerCase())
        )
        ||
        user.role.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter || user.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });

    this.totalPages = Math.ceil(this.filteredUsers.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  /** Reset filters */
  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.applyFilters();
  }

  /** Role-wise user count helpers */
  get adminCount(): number { return this.users.filter(u => u.role === 'ADMIN').length; }
  get subAdminCount(): number { return this.users.filter(u => u.role === 'SUB_ADMIN').length; }
  get hodCount(): number { return this.users.filter(u => u.role === 'HOD').length; }

  /** Department-wise user breakdown */
  get deptUserBreakdown(): { name: string; count: number; active: number; inactive: number }[] {
    const map = new Map<string, { count: number; active: number; inactive: number }>();
    for (const user of this.users) {
      const depts = user.departmentNames?.length ? user.departmentNames : ['Unassigned'];
      for (const dept of depts) {
        const entry = map.get(dept) ?? { count: 0, active: 0, inactive: 0 };
        entry.count++;
        if (user.status === 'ACTIVE') entry.active++; else entry.inactive++;
        map.set(dept, entry);
      }
    }
    return Array.from(map.entries())
      .map(([name, val]) => ({ name, ...val }))
      .sort((a, b) => b.count - a.count);
  }

  /** Change pagination page */
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
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
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
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

  openAddUserModal(): void {
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
    this.addUserSubDepts = [];
    this.addUserShowManagerDrop = false;
    this.addUserShowSubDeptDrop = false;
    this.addUserDeptSearch = '';
    this.addUserManagerSearch = '';
    this.addUserSubjects = [];
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
        next: (depts) => { this.availableDepartments = depts; },
        error: () => {}
      });
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
        next: (managers) => { this.addUserEligibleManagers = managers; },
        error: () => {}
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
    if (!this.addUserDeptSearch.trim()) return this.availableDepartments;
    return this.availableDepartments.filter(d =>
      d.name.toLowerCase().includes(this.addUserDeptSearch.toLowerCase())
    );
  }

  reloadAddUserSubDepts(): void {
    if (this.addUserPayload.departmentIds.length === 0) {
      this.addUserSubDepts = [];
      this.addUserSubjects = [];
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
      error: () => {}
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
    const q = this.addUserManagerSearch.toLowerCase().trim();
    if (!q) return this.addUserEligibleManagers;
    return this.addUserEligibleManagers.filter(u =>
      u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
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
      this.addUserSelectedSubjectIds = [];
      return;
    }

    if (subDeptId) {
      // Load by sub-department — exact same as original: getSubjects(null, subDeptId)
      this.subjectApiService.getSubjects(null, subDeptId).subscribe({
        next: (subs) => {
          this.addUserSubjects = subs;
          // Remove selected subjects no longer valid
          this.addUserSelectedSubjectIds = this.addUserSelectedSubjectIds.filter(
            id => subs.some((s: any) => s.id === id)
          );
        },
        error: () => {}
      });
    } else if (deptIds.length > 0) {
      // Fallback: load by departments
      const reqs = deptIds.map(id => this.subjectApiService.getSubjects(id, null));
      forkJoin(reqs).subscribe({
        next: (results) => {
          const merged = results.flat();
          const unique = merged.filter((s, i, arr) => arr.findIndex((x: any) => x.id === s.id) === i);
          this.addUserSubjects = unique;
          this.addUserSelectedSubjectIds = this.addUserSelectedSubjectIds.filter(
            id => unique.some((s: any) => s.id === id)
          );
        },
        error: () => {}
      });
    }
  }

  filteredAddUserSubjects(): any[] {
    const q = this.addUserSubjectSearch.toLowerCase().trim();
    if (!q) return this.addUserSubjects;
    return this.addUserSubjects.filter(s =>
      s.subjectName?.toLowerCase().includes(q) || s.subjectCode?.toLowerCase().includes(q)
    );
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

  goBackToDashboard() {    const token = this.jwtService.getAccessToken();
    if (token) {
      const payload = this.jwtService.decodeToken(token);
      this.authApiService.goToDashboard();
    } else {
      this.router.navigate(['/login']);
    }
  }

  goToBulkImport(): void {
    this.router.navigate(['/users/import']);
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




