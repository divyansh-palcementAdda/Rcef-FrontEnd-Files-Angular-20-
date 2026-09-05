import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { JwtService } from '../../../Services/jwt-service';
import { SidebarService } from '../../../Services/sidebar-service';
import { Subject, Subscription } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

interface SidebarLink {
  label: string;
  route: string;
  queryParams?: Record<string, string>;
  icon: string;
  isGroup?: boolean;
  children?: SidebarLink[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  role: string | null = null;
  username: string = 'User';
  fullName: string = 'User';
  isCollapsed = false;
  links: SidebarLink[] = [];
  settingsOpen = false;

  // Tracks which sidebar link was last explicitly clicked by the user
  private lastClickedRoute: string | null = null;
  private lastClickedQueryParams: Record<string, string> | null = null;
  private routerSub = new Subscription();
  private readonly destroy$ = new Subject<void>();

  // Tracks the previous URL to detect navigation from view-tasks → task detail
  private previousUrl: string = '';
  private currentUrl: string = '';

  constructor(
    private authService: AuthApiService,
    private router: Router,
    private userApiService: UserApiService,
    private jwtService: JwtService,
    private sidebarService: SidebarService
  ) { }

  ngOnInit(): void {
    this.role = this.authService.getCurrentRole();
    this.authService.username$.subscribe(name => {
      this.username = name;
      if (!this.fullName || this.fullName === 'User' || this.fullName.includes('@')) {
        this.fullName = this.formatName(name);
      }
    });
    // Build links once now (with whatever permissions are cached), then
    // rebuild whenever permissions finish loading from the backend so the
    // Dashboard link always points to the correct route.
    this.buildLinks();
    this.authService.permissionsObservable$.pipe(
      filter(perms => perms.length > 0),
      takeUntil(this.destroy$)
    ).subscribe(() => this.buildLinks());
    this.loadUserProfile();
    this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
    });

    // Track URL changes to detect navigation from view-tasks → task detail
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const url: string = e.urlAfterRedirects || e.url;

        this.previousUrl = this.currentUrl;
        this.currentUrl = url;

        // If user came from /view-tasks?status=... and went to /task/:id or /edit-task
        // auto-set the lastClicked based on the previous URL's query params
        if (
          (url.startsWith('/task/') || url.startsWith('/edit-task')) &&
          this.previousUrl.startsWith('/view-tasks')
        ) {
          // Extract query params from previous view-tasks URL
          const queryString = this.previousUrl.includes('?')
            ? this.previousUrl.split('?')[1]
            : '';
          const params: Record<string, string> = {};
          if (queryString) {
            queryString.split('&').forEach(pair => {
              const [key, value] = pair.split('=');
              if (key && value) params[key] = value;
            });
          }
          this.lastClickedRoute = '/view-tasks';
          this.lastClickedQueryParams = Object.keys(params).length > 0 ? params : null;
        }

        // If navigating away from task-detail to somewhere unrelated, clear sticky state
        if (!url.startsWith('/task/') && !url.startsWith('/edit-task') && !url.startsWith('/view-tasks')) {
          this.lastClickedRoute = null;
          this.lastClickedQueryParams = null;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.routerSub.unsubscribe();
  }

  loadUserProfile(): void {
    const token = this.authService.getAccessToken();
    if (token) {
      const userId = this.jwtService.getUserIdFromToken(token);
      if (userId) {
        this.userApiService.getCurrentUserProfile(userId).subscribe({
          next: (user) => {
            if (user && user.fullName) {
              this.fullName = user.fullName;
            }
          },
          error: (err) => console.warn('Failed to load user profile in sidebar:', err)
        });
      }
    }
  }

  formatName(name: string): string {
    if (!name) return 'User';
    if (name.includes('@')) {
      const part = name.split('@')[0];
      return part.charAt(0).toUpperCase() + part.slice(1);
    }
    return name;
  }

  toggleCollapse(): void {
    this.sidebarService.toggleCollapsed();
  }

  toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen;
  }

  isSettingsActive(): boolean {
    const settingsRoutes = ['/task-templates', '/roles-permissions'];
    return settingsRoutes.some(r => this.router.url.startsWith(r));
  }

  onLinkClick(link: SidebarLink): void {
    // Remember which sidebar link was clicked
    this.lastClickedRoute = link.route;
    this.lastClickedQueryParams = link.queryParams || null;

    if (window.innerWidth < 768) {
      this.sidebarService.setMobileSidebarOpen(false);
    }
  }

  /**
   * Returns true if the given link should appear active.
   * Stays active even when user navigates to child pages like /task/:id or /edit-task
   */
  isLinkActive(link: SidebarLink): boolean {
    const currentUrl = this.router.url;

    // Standard match: current URL matches the link's route
    if (currentUrl.startsWith(link.route)) {
      // For query-param-based links, also check the query param matches
      if (link.queryParams) {
        const paramKey = Object.keys(link.queryParams)[0];
        const paramValue = link.queryParams[paramKey];
        return currentUrl.toLowerCase().includes(`${paramKey}=${paramValue}`.toLowerCase());
      }
      // For the main Tasks link (no query params), exclude if URL has query parameters matching other links
      if (link.route === '/view-tasks') {
        const lowerUrl = currentUrl.toLowerCase();
        if (
          lowerUrl.includes('status=self') ||
          lowerUrl.includes('status=approval') ||
          lowerUrl.includes('status=selfassigned') ||
          lowerUrl.includes('view=self')
        ) {
          return false;
        }
      }
      return true;
    }

    // Sticky match: user clicked this link and then navigated to a child page
    if (
      this.lastClickedRoute === link.route &&
      (currentUrl.startsWith('/task/') || currentUrl.startsWith('/edit-task'))
    ) {
      if (link.queryParams && this.lastClickedQueryParams) {
        const paramKey = Object.keys(link.queryParams)[0];
        return this.lastClickedQueryParams[paramKey] === link.queryParams[paramKey];
      }
      return !link.queryParams;
    }

    return false;
  }

  logout(): void {
    const refreshToken = this.authService.getRefreshToken() ?? undefined;
    this.authService.logout(refreshToken).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  private buildLinks(): void {
    const localLinks: SidebarLink[] = [];

    // 1. Dashboard (dynamic route based on role first, then permissions)
    // Role is always available from the JWT; permissions may load asynchronously,
    // so we use role as the authoritative source to avoid a race condition where
    // buildLinks() runs before permissions are fetched from the backend.
    const currentRole = this.authService.getCurrentRole();
    let dashboardRoute: string;
    if (currentRole === 'SUPER_ADMIN' || currentRole === 'ADMIN' || currentRole === 'SUB_ADMIN') {
      dashboardRoute = '/admin';
    } else if (currentRole === 'HOD') {
      dashboardRoute = '/hod';
    } else if (currentRole === 'TEACHER') {
      dashboardRoute = '/teacher';
    } else if (this.hasPermission('AUDIT_LOG_VIEW')) {
      // Fallback to permission-based detection for unknown/future roles
      dashboardRoute = '/admin';
    } else if (this.hasPermission('SUB_DEPARTMENT_REPORT_VIEW')) {
      dashboardRoute = '/hod';
    } else {
      dashboardRoute = '/teacher';
    }
    localLinks.push({ label: 'Dashboard', route: dashboardRoute, icon: 'bi-grid-fill' });

    // 2. All Tasks
    if (this.hasPermission('TASK_VIEW')) {
      localLinks.push({ label: 'All Task', route: '/view-tasks', icon: 'bi-list-check' });

      // 3. Self Task (hidden for TEACHER role)
      if (currentRole !== 'TEACHER') {
        if (this.hasPermission('AUDIT_LOG_VIEW')) {
          localLinks.push({ label: 'My Task', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-person-badge' });
        } else if (this.hasPermission('SUB_DEPARTMENT_REPORT_VIEW')) {
          localLinks.push({ label: 'My Task', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-person-badge' });
        } else {
          localLinks.push({ label: 'My Task', route: '/view-tasks', queryParams: { view: 'Self' }, icon: 'bi-person-badge' });
        }
      }

      // Commented out: Pending Approvals
      // localLinks.push({ label: 'Pending Approvals', route: '/view-tasks', queryParams: { status: 'Approval' }, icon: 'bi-check2-circle' });

      // Commented out: Self-Assigned Tasks
      // localLinks.push({ label: 'Self-Assigned Tasks', route: '/view-tasks', queryParams: { status: 'selfAssigned' }, icon: 'bi-person-check-fill' });
    }

    // 4. All User (hidden for TEACHER role)
    if (this.hasPermission('USER_VIEW') && currentRole !== 'TEACHER' && currentRole !== 'HOD') {
      localLinks.push({ label: 'All User', route: '/viewAllUsers', icon: 'bi-people' });
    }

    // 5. All Department / Sub Department
    if (this.hasPermission('DEPARTMENT_VIEW') && currentRole !== 'TEACHER' && currentRole !== 'HOD') {
      localLinks.push({ label: 'All Department / Sub Department', route: '/departments', icon: 'bi-building' });
    }
    // Commented out: Sub Department as separate link (merged with All Department above)
    // if (this.hasPermission('SUB_DEPARTMENT_VIEW')) {
    //   localLinks.push({ label: 'Sub Department', route: '/sub-departments', icon: 'bi-diagram-2-fill' });
    // }

    // Commented out: Subjects
    // if (this.hasPermission('SUBJECT_VIEW')) {
    //   localLinks.push({ label: 'Subjects', route: '/subjects', icon: 'bi-journal-text' });
    // }

    // 6. All Work (Task Requests & Analytics)
    if (this.hasPermission('TASK_APPROVE')) {
      localLinks.push({ label: 'Pending Approval', route: '/task-requests', queryParams: { status: 'PENDING' }, icon: 'bi-hourglass-split' });
    } else if (this.hasPermission('TASK_REQUEST_VIEW_SELF') || currentRole === 'TEACHER') {
      localLinks.push({ label: 'My Requests', route: '/task-requests', icon: 'bi-file-earmark-text' });
    }

    if (this.hasPermission('WORK_VIEW')) {
      localLinks.push({ label: 'All Work', route: '/all-work', icon: 'bi-briefcase-fill' });
    } else if (this.hasPermission('REPORT_VIEW')) {
      localLinks.push({ label: 'All Work', route: '/task-requests', icon: 'bi-briefcase-fill' });
    }

    if (this.hasPermission('WORK_ANALYTICS_VIEW') || this.hasPermission('WORK_VIEW') || this.hasPermission('USER_VIEW')) {
      localLinks.push({ label: 'User Task Analytics', route: '/user-task-analytics', icon: 'bi-bar-chart-line-fill' });
    }

    // 7. User Hierarchy (User Heriky)
    // if (this.hasPermission('USER_VIEW') && (this.hasPermission('SUB_DEPARTMENT_REPORT_VIEW') || this.hasPermission('AUDIT_LOG_VIEW')) && currentRole !== 'TEACHER' && currentRole !== 'HOD') {
    //   localLinks.push({ label: 'User Hierarchy', route: '/hierarchy-tree', icon: 'bi-diagram-3-fill' });
    // }

    // 8. Recurring Task
    // if (this.hasPermission('TASK_CREATE') && this.hasPermission('AUDIT_LOG_VIEW') && currentRole !== 'TEACHER' && currentRole !== 'HOD') {
    //   localLinks.push({ label: 'Recurring Task', route: '/createRecurring', icon: 'bi-arrow-repeat' });
    // }

    // Commented out: Import Users
    // if (this.hasPermission('USER_CREATE')) {
    //   localLinks.push({ label: 'Import Users', route: '/users/import', icon: 'bi-file-earmark-excel-fill' });
    // }

    // Commented out: Import Tasks
    // if (this.hasPermission('TASK_CREATE')) {
    //   localLinks.push({ label: 'Import Tasks', route: '/tasks/import', icon: 'bi-file-earmark-arrow-up-fill' });
    // }

    // 9. Setting (group) — Task Template & Roles & Permissions inside it
    if (this.role === 'SUPER_ADMIN') {
      const settingsChildren: SidebarLink[] = [];

      // settingsChildren.push({ label: 'Task Template', route: '/task-templates', icon: 'bi-file-earmark-ruled-fill' });

      settingsChildren.push({ label: 'Role and Permission', route: '/roles-permissions', icon: 'bi-shield-lock-fill' });

      localLinks.push({
        label: 'Setting',
        route: '',
        icon: 'bi-gear-fill',
        isGroup: true,
        children: settingsChildren
      });
    }

    this.links = localLinks;
  }
}
