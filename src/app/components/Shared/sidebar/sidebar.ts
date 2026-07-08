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
    const r = this.role ? this.role.toUpperCase() : '';

    if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'SUB_ADMIN') {
      this.links = [
        { label: 'Dashboard', route: '/admin', icon: 'bi-grid-fill' },
        { label: 'Tasks', route: '/view-tasks', icon: 'bi-list-check' },
        { label: 'Users', route: '/viewAllUsers', icon: 'bi-people' },
        { label: 'Departments', route: '/departments', icon: 'bi-building' },
        { label: 'Self Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-list-check' },
        { label: 'Pending Approvals', route: '/view-tasks', queryParams: { status: 'Approval' }, icon: 'bi-check2-circle' },
        { label: 'Add Task', route: '/add-task', icon: 'bi-plus-circle-fill' },
        { label: 'Add User', route: '/add-user', icon: 'bi-person-plus-fill' },
        { label: 'Add Department', route: '/add-department', icon: 'bi-building-fill' },
        { label: 'Departments', route: '/departments', icon: 'bi-layers-fill' },
        { label: 'Sub-Departments', route: '/sub-departments', icon: 'bi-diagram-2-fill' },
        { label: 'Subjects', route: '/subjects', icon: 'bi-journal-text' },
        { label: 'User Hierarchy', route: '/hierarchy-tree', icon: 'bi-diagram-3-fill' },
        { label: 'Recurring Tasks', route: '/createRecurring', icon: 'bi-arrow-repeat' },
        { label: 'Task Templates', route: '/task-templates', icon: 'bi-file-earmark-ruled-fill' },
        { label: 'Roles & Permissions', route: '/roles-permissions', icon: 'bi-shield-lock-fill' }
      ];
    } else if (r === 'HOD') {
      this.links = [
        { label: 'Dashboard', route: '/hod', icon: 'bi-grid-fill' },
        { label: 'Tasks', route: '/view-tasks', icon: 'bi-list-check' },
        { label: 'Users', route: '/viewAllUsers', icon: 'bi-people' }
      ];
      if (this.hasPermission('DEPARTMENT_CREATE')) {
        this.links.push({ label: 'Departments', route: '/departments', icon: 'bi-building' });
      }
      if (this.hasPermission('SUBJECT_VIEW')) {
        this.links.push({ label: 'Subjects', route: '/subjects', icon: 'bi-journal-text' });
      }
      this.links.push(
        { label: 'My Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-list-check' },
        { label: 'Add Task', route: '/add-task', icon: 'bi-plus-circle-fill' },
        { label: 'Self-Assigned Tasks', route: '/view-tasks', queryParams: { status: 'selfAssigned' }, icon: 'bi-person-check-fill' },
        { label: 'Task Requests', route: '/task-requests', queryParams: { status: 'PENDING' }, icon: 'bi-clock-history' },
        { label: 'Team Members', route: '/viewAllUsers', icon: 'bi-people-fill' },
        { label: 'User Hierarchy', route: '/hierarchy-tree', icon: 'bi-diagram-3-fill' }
      );
    } else if (r === 'TEACHER') {
      this.links = [
        { label: 'Dashboard', route: '/teacher', icon: 'bi-grid-fill' },
        { label: 'Tasks', route: '/view-tasks', icon: 'bi-list-check' }
      ];
      if (this.hasPermission('USER_VIEW')) {
        this.links.push({ label: 'Users', route: '/viewAllUsers', icon: 'bi-people' });
      }
      if (this.hasPermission('DEPARTMENT_CREATE')) {
        this.links.push({ label: 'Departments', route: '/departments', icon: 'bi-building' });
      }
      if (this.hasPermission('SUBJECT_VIEW')) {
        this.links.push({ label: 'Subjects', route: '/subjects', icon: 'bi-journal-text' });
      }
      this.links.push(
        { label: 'My Tasks', route: '/view-tasks', queryParams: { view: 'Self' }, icon: 'bi-list-check' },
        { label: 'Task Requests', route: '/task-requests', icon: 'bi-clock-history' }
      );
    }
  }
}
