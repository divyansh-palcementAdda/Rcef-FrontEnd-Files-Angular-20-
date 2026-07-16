import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { JwtService } from '../../../Services/jwt-service';
import { SidebarService } from '../../../Services/sidebar-service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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
    this.buildLinks();
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

    // 1. Dashboard (dynamic route based on permissions)
    let dashboardRoute = '/teacher';
    if (this.hasPermission('AUDIT_LOG_VIEW')) {
      dashboardRoute = '/admin';
    } else if (this.hasPermission('SUB_DEPARTMENT_REPORT_VIEW')) {
      dashboardRoute = '/hod';
    }
    localLinks.push({ label: 'Dashboard', route: dashboardRoute, icon: 'bi-grid-fill' });

    // 2. Tasks
    if (this.hasPermission('TASK_VIEW')) {
      localLinks.push({ label: 'Tasks', route: '/view-tasks', icon: 'bi-list-check' });

      // Scoped Task Views
      if (this.hasPermission('AUDIT_LOG_VIEW')) {
        localLinks.push({ label: 'Self Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-person-badge' });
        localLinks.push({ label: 'Pending Approvals', route: '/view-tasks', queryParams: { status: 'Approval' }, icon: 'bi-check2-circle' });
      } else if (this.hasPermission('SUB_DEPARTMENT_REPORT_VIEW')) {
        localLinks.push({ label: 'My Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-person-badge' });
        localLinks.push({ label: 'Self-Assigned Tasks', route: '/view-tasks', queryParams: { status: 'selfAssigned' }, icon: 'bi-person-check-fill' });
      } else {
        localLinks.push({ label: 'My Tasks', route: '/view-tasks', queryParams: { view: 'Self' }, icon: 'bi-person-badge' });
      }
    }

    // 3. User lists
    if (this.hasPermission('USER_VIEW')) {
      if (this.hasPermission('AUDIT_LOG_VIEW')) {
        localLinks.push({ label: 'Users', route: '/viewAllUsers', icon: 'bi-people' });
      } else if (this.hasPermission('SUB_DEPARTMENT_REPORT_VIEW')) {
        localLinks.push({ label: 'Team Members', route: '/viewAllUsers', icon: 'bi-people-fill' });
      } else {
        localLinks.push({ label: 'Users', route: '/viewAllUsers', icon: 'bi-people' });
      }
    }

    // 4. Departments
    if (this.hasPermission('DEPARTMENT_VIEW')) {
      localLinks.push({ label: 'Departments', route: '/departments', icon: 'bi-building' });
    }

    // 5. Sub-Departments
    if (this.hasPermission('SUB_DEPARTMENT_VIEW')) {
      localLinks.push({ label: 'Sub-Departments', route: '/sub-departments', icon: 'bi-diagram-2-fill' });
    }

    // 6. Subjects
    if (this.hasPermission('SUBJECT_VIEW')) {
      localLinks.push({ label: 'Subjects', route: '/subjects', icon: 'bi-journal-text' });
    }

    // 7. User Hierarchy
    if (this.hasPermission('USER_VIEW') && (this.hasPermission('SUB_DEPARTMENT_REPORT_VIEW') || this.hasPermission('AUDIT_LOG_VIEW'))) {
      localLinks.push({ label: 'User Hierarchy', route: '/hierarchy-tree', icon: 'bi-diagram-3-fill' });
    }

    // 8. Recurring Tasks & Templates
    if (this.hasPermission('TASK_CREATE') && this.hasPermission('AUDIT_LOG_VIEW')) {
      localLinks.push({ label: 'Recurring Tasks', route: '/createRecurring', icon: 'bi-arrow-repeat' });
      localLinks.push({ label: 'Task Templates', route: '/task-templates', icon: 'bi-file-earmark-ruled-fill' });
    }

    // 9. Task Requests
    if (this.hasPermission('TASK_APPROVE')) {
      localLinks.push({ label: 'Task Requests', route: '/task-requests', queryParams: { status: 'PENDING' }, icon: 'bi-clock-history' });
    } else if (this.hasPermission('REPORT_VIEW')) {
      localLinks.push({ label: 'Task Requests', route: '/task-requests', icon: 'bi-clock-history' });
    }

    // 10. Bulk Import
    if (this.hasPermission('USER_CREATE')) {
      localLinks.push({ label: 'Import Users', route: '/users/import', icon: 'bi-file-earmark-excel-fill' });
    }
    if (this.hasPermission('TASK_CREATE')) {
      localLinks.push({ label: 'Import Tasks', route: '/tasks/import', icon: 'bi-file-earmark-arrow-up-fill' });
    }

    // 11. Roles & Permissions Management
    if (this.hasPermission('USER_EDIT') && this.hasPermission('AUDIT_LOG_VIEW')) {
      localLinks.push({ label: 'Roles & Permissions', route: '/roles-permissions', icon: 'bi-shield-lock-fill' });
    }

    this.links = localLinks;
  }
}
