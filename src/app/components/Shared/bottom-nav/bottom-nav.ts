import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { JwtService } from '../../../Services/jwt-service';

interface BottomNavLink {
  label: string;
  route: string;
  queryParams?: Record<string, string>;
  icon: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './bottom-nav.html',
  styleUrls: ['./bottom-nav.css']
})
export class BottomNavComponent implements OnInit {
  role: string | null = null;
  username: string = 'User';
  fullName: string = 'User';

  primaryLinks: BottomNavLink[] = [];
  moreLinks: BottomNavLink[] = [];
  isMoreOpen = false;

  constructor(
    private authService: AuthApiService,
    private router: Router,
    private userApiService: UserApiService,
    private jwtService: JwtService
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
  }

  loadUserProfile(): void {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const userId = this.jwtService.getUserIdFromToken(token);
      if (userId) {
        this.userApiService.getUserById(userId).subscribe({
          next: (user) => {
            if (user && user.fullName) {
              this.fullName = user.fullName;
            }
          },
          error: (err) => console.warn('Failed to load user profile in bottom-nav:', err)
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

  toggleMoreSheet(): void {
    this.isMoreOpen = !this.isMoreOpen;
    if (this.isMoreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeMoreSheet(): void {
    this.isMoreOpen = false;
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: any) {
    if (this.isMoreOpen) {
      this.closeMoreSheet();
    }
  }

  logout(): void {
    this.closeMoreSheet();
    const refreshToken = this.authService.getRefreshToken() ?? undefined;
    this.authService.logout(refreshToken).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  hasPermission(permission: string): boolean {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role === 'SUPER_ADMIN') return true;
      const permissions = payload.permissions as string[] || [];
      return permissions.includes(permission);
    } catch {
      return false;
    }
  }

  isLinkActive(link: BottomNavLink): boolean {
    const currentUrl = this.router.url;

    // Standard match: current URL matches the link's route
    if (currentUrl.startsWith(link.route)) {
      // For query-param-based links, also check the query param matches
      if (link.queryParams) {
        const paramKey = Object.keys(link.queryParams)[0];
        const paramValue = link.queryParams[paramKey];
        return currentUrl.toLowerCase().includes(`${paramKey}=${paramValue}`.toLowerCase());
      }
      // Special exact check for dashboards
      if (link.route === '/admin' || link.route === '/hod' || link.route === '/teacher') {
        return currentUrl.split('?')[0] === link.route;
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
    return false;
  }

  private buildLinks(): void {
    const r = this.role ? this.role.toUpperCase() : '';

    if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'SUB_ADMIN') {
      // Primary Links (Max 5 items)
      this.primaryLinks = [
        { label: 'Dashboard', route: '/admin', icon: 'dashboard' },
        { label: 'Tasks', route: '/view-tasks', icon: 'tasks' },
        { label: 'Users', route: '/viewAllUsers', icon: 'users' },
        { label: 'Departments', route: '/departments', icon: 'departments' },
        { label: 'Hierarchy', route: '/hierarchy-tree', icon: 'hierarchy' }
      ];
      // Secondary/More Sheet Links
      this.moreLinks = [
        { label: 'Self Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'tasks' },
        { label: 'Pending Approvals', route: '/view-tasks', queryParams: { status: 'Approval' }, icon: 'approvals' },
        { label: 'Add Task', route: '/add-task', icon: 'add-task' },
        { label: 'Add User', route: '/add-user', icon: 'add-user' },
        { label: 'Add Department', route: '/add-department', icon: 'add-department' },
        { label: 'Sub-Departments', route: '/sub-departments', icon: 'sub-departments' },
        { label: 'Recurring Tasks', route: '/createRecurring', icon: 'recurring' },
        { label: 'Task Templates', route: '/task-templates', icon: 'templates' },
        { label: 'Roles & Permissions', route: '/roles-permissions', icon: 'permissions' }
      ];
    } else if (r === 'HOD') {
      // Primary Links
      this.primaryLinks = [
        { label: 'Dashboard', route: '/hod', icon: 'dashboard' },
        { label: 'Tasks', route: '/view-tasks', icon: 'tasks' },
        { label: 'Users', route: '/viewAllUsers', icon: 'users' }
      ];

      const hasDept = this.hasPermission('DEPARTMENT_CREATE');
      if (hasDept) {
        this.primaryLinks.push({ label: 'Departments', route: '/departments', icon: 'departments' });
      } else {
        this.primaryLinks.push({ label: 'Hierarchy', route: '/hierarchy-tree', icon: 'hierarchy' });
      }

      // Secondary/More Sheet Links
      this.moreLinks = [
        { label: 'My Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'tasks' },
        { label: 'Add Task', route: '/add-task', icon: 'add-task' },
        { label: 'Self-Assigned Tasks', route: '/view-tasks', queryParams: { status: 'selfAssigned' }, icon: 'tasks' },
        { label: 'Task Requests', route: '/task-requests', queryParams: { status: 'PENDING' }, icon: 'approvals' }
      ];

      if (hasDept) {
        this.moreLinks.push({ label: 'Hierarchy', route: '/hierarchy-tree', icon: 'hierarchy' });
      }
    } else if (r === 'TEACHER') {
      // Primary Links
      this.primaryLinks = [
        { label: 'Dashboard', route: '/teacher', icon: 'dashboard' },
        { label: 'Tasks', route: '/view-tasks', icon: 'tasks' }
      ];
      if (this.hasPermission('USER_VIEW')) {
        this.primaryLinks.push({ label: 'Users', route: '/viewAllUsers', icon: 'users' });
      }
      if (this.hasPermission('DEPARTMENT_CREATE')) {
        this.primaryLinks.push({ label: 'Departments', route: '/departments', icon: 'departments' });
      }

      // Secondary/More Sheet Links
      this.moreLinks = [
        { label: 'My Tasks', route: '/view-tasks', queryParams: { view: 'Self' }, icon: 'tasks' },
        { label: 'Requests', route: '/task-requests', icon: 'approvals' }
      ];
    }
  }
}
