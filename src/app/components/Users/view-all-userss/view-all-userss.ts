// view-all-userss.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { userDto } from '../../../Model/userDto';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../Services/UserApiService';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalService } from '../../../Services/modal-service';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';
import { ToastService } from '../../../Services/ToastData';

@Component({
  selector: 'app-view-all-users',
  templateUrl: './view-all-userss.html',
  styleUrls: ['./view-all-userss.css'],
  imports: [CommonModule, FormsModule]
})
export class ViewAllUserss implements OnInit {

  users: userDto[] = [];
  filteredUsers: userDto[] = [];

  errorMessage: string | null = null;
  loading = true;

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
    private toastService: ToastService
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
          this.hodSubDepartmentId = user.subDepartmentId;   // UUID string
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
        obs$ = this.apiService.getAllUsersBySubDepartment(this.hodSubDepartmentId).pipe(
          switchMap(subDeptUsers =>
            this.apiService.getAllUsersByStatus('ACTIVE').pipe(
              map(activeUsers => {
                const activeUserIds = new Set(activeUsers.map(u => u.userId));
                return subDeptUsers.filter(user => activeUserIds.has(user.userId));
              })
            )
          )
        );
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

  goBackToDashboard() {
    const token = this.jwtService.getAccessToken();
    if (token) {
      const payload = this.jwtService.decodeToken(token);
      this.authApiService.goToDashboard();
    } else {
      this.router.navigate(['/login']);
    }
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




