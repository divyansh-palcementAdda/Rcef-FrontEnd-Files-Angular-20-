import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { JwtService } from '../../../Services/jwt-service';
import { SidebarService } from '../../../Services/sidebar-service';

interface SidebarLink {
  label: string;
  route: string;
  queryParams?: Record<string, string>;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements OnInit {
  role: string | null = null;
  username: string = 'User';
  fullName: string = 'User';
  isCollapsed = false;
  links: SidebarLink[] = [];

  constructor(
    private authService: AuthApiService,
    private router: Router,
    private userApiService: UserApiService,
    private jwtService: JwtService,
    private sidebarService: SidebarService
  ) {}

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

  onLinkClick(): void {
    if (window.innerWidth < 768) {
      this.sidebarService.setMobileSidebarOpen(false);
    }
  }

  logout(): void {
    const refreshToken = this.authService.getRefreshToken() ?? undefined;
    this.authService.logout(refreshToken).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }

  private buildLinks(): void {
    const r = this.role ? this.role.toUpperCase() : '';

    if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'SUB_ADMIN') {
      this.links = [
        { label: 'Dashboard', route: '/admin', icon: 'bi-grid-fill' },
        { label: 'Self Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-list-check' },
        { label: 'Pending Approvals', route: '/view-tasks', queryParams: { status: 'Approval' }, icon: 'bi-check2-circle' },
        { label: 'Add Task', route: '/add-task', icon: 'bi-plus-circle-fill' },
        { label: 'Add User', route: '/add-user', icon: 'bi-person-plus-fill' },
        { label: 'Add Department', route: '/add-department', icon: 'bi-building-fill' },
        { label: 'Departments', route: '/departments', icon: 'bi-layers-fill' },
        { label: 'Sub-Departments', route: '/sub-departments', icon: 'bi-diagram-2-fill' },
        { label: 'User Hierarchy', route: '/hierarchy-tree', icon: 'bi-diagram-3-fill' },
        { label: 'Recurring Tasks', route: '/createRecurring', icon: 'bi-arrow-repeat' },
        { label: 'Task Templates', route: '/task-templates', icon: 'bi-file-earmark-ruled-fill' },
        { label: 'Roles & Permissions', route: '/roles-permissions', icon: 'bi-shield-lock-fill' }
      ];
    } else if (r === 'HOD') {
      this.links = [
        { label: 'Dashboard', route: '/hod', icon: 'bi-grid-fill' },
        { label: 'My Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'bi-list-check' },
        { label: 'Add Task', route: '/add-task', icon: 'bi-plus-circle-fill' },
        { label: 'Self-Assigned Tasks', route: '/view-tasks', queryParams: { status: 'selfAssigned' }, icon: 'bi-person-check-fill' },
        { label: 'Task Requests', route: '/task-requests', queryParams: { status: 'PENDING' }, icon: 'bi-clock-history' },
        { label: 'Team Members', route: '/viewAllUsers', icon: 'bi-people-fill' },
        { label: 'User Hierarchy', route: '/hierarchy-tree', icon: 'bi-diagram-3-fill' }
      ];
    } else if (r === 'TEACHER') {
      this.links = [
        { label: 'Dashboard', route: '/teacher', icon: 'bi-grid-fill' },
        { label: 'My Tasks', route: '/view-tasks', queryParams: { view: 'Self' }, icon: 'bi-list-check' },
        { label: 'Task Requests', route: '/task-requests', icon: 'bi-clock-history' }
      ];
    }
  }
}
