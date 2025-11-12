// view-all-userss.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { userDto } from '../../../Model/userDto';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../Services/UserApiService';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';

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
  private hodDepartmentId?: number;      // only for HOD

  constructor(
    private apiService: UserApiService,
    private router: Router,
    private route: ActivatedRoute,
    private authApiService: AuthApiService,
    private jwtService: JwtService
  ) {}

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
    this.currentRole   = (decoded['role'] as string ?? '').toUpperCase();

    if (this.currentRole === 'HOD') {
      // HOD needs department → fetch full user DTO
      return this.apiService.getUserById(this.currentUserId).pipe(
        switchMap((user: userDto) => {
          this.hodDepartmentId = user.departmentIds[0];   // <-- adjust property name if different
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

    if (this.currentRole === 'ADMIN') {
      // ADMIN sees everything
      obs$ = this.statusFilter
        ? this.apiService.getAllUsersByStatus(this.statusFilter)
        : this.apiService.getAllUsers();
    } else if (this.currentRole === 'HOD' && this.hodDepartmentId !== undefined) {
  obs$ = this.apiService.getAllUsersByDepartment(this.hodDepartmentId).pipe(
    switchMap(deptUsers =>
      this.apiService.getAllUsersByStatus('ACTIVE').pipe(
        map(activeUsers => {
          const activeUserIds = new Set(activeUsers.map(u => u.userId));
          return deptUsers.filter(user => activeUserIds.has(user.userId));
        })
      )
    )
  );
}else {
      // fallback – should never happen
      this.errorMessage = 'Invalid role or missing department';
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

   /** Generate array of page numbers for pagination */
  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
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

  if (confirm('Are you sure you want to delete this user?')) {
    this.apiService.deleteUser(userId).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.userId !== userId);
        this.applyFilters();
      },
      error: (err: any) => {
        alert(err?.error?.message || 'Failed to delete user.');
      }
    });
  }
}
activateUser(event: Event, userId: number): void {
  event.stopPropagation();

  if (confirm('Are you sure you want to activate this user?')) {
    this.apiService.toggleUserStatus(userId).subscribe({
      next: (res) => {
        // Optimistically update status to ACTIVE
        const user = this.users.find(u => u.userId === userId);
        if (user) {
          user.status = 'ACTIVE';
        }
        this.applyFilters();
        // Optional: this.toastr.success(res.message || 'User activated successfully');
      },
      error: (err: any) => {
        alert(err?.error?.message || 'Failed to activate user.');
      }
    });
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
}




  