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
  imports: [CommonModule, RouterLink, RouterLinkActive],
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

  private buildLinks(): void {
    const r = this.role ? this.role.toUpperCase() : '';

    if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'SUB_ADMIN') {
      // Primary Links (Max 5 items)
      this.primaryLinks = [
        { label: 'Dashboard', route: '/admin', icon: 'dashboard' },
        { label: 'Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'tasks' },
        { label: 'Users', route: '/add-user', icon: 'users' },
        { label: 'Departments', route: '/departments', icon: 'departments' },
        { label: 'Hierarchy', route: '/hierarchy-tree', icon: 'hierarchy' }
      ];
      // Secondary/More Sheet Links
      this.moreLinks = [
        { label: 'Pending Approvals', route: '/view-tasks', queryParams: { status: 'Approval' }, icon: 'approvals' },
        { label: 'Add Task', route: '/add-task', icon: 'add-task' },
        { label: 'Add Department', route: '/add-department', icon: 'add-department' },
        { label: 'Sub-Departments', route: '/sub-departments', icon: 'sub-departments' },
        { label: 'Recurring Tasks', route: '/createRecurring', icon: 'recurring' },
        { label: 'Task Templates', route: '/task-templates', icon: 'templates' },
        { label: 'Roles & Permissions', route: '/roles-permissions', icon: 'permissions' }
      ];
    } else if (r === 'HOD') {
      // Primary Links (Max 4 items)
      this.primaryLinks = [
        { label: 'Dashboard', route: '/hod', icon: 'dashboard' },
        { label: 'My Tasks', route: '/view-tasks', queryParams: { status: 'Self' }, icon: 'tasks' },
        { label: 'Users', route: '/viewAllUsers', icon: 'users' },
        { label: 'Hierarchy', route: '/hierarchy-tree', icon: 'hierarchy' }
      ];
      // Secondary/More Sheet Links
      this.moreLinks = [
        { label: 'Add Task', route: '/add-task', icon: 'add-task' },
        { label: 'Self-Assigned Tasks', route: '/view-tasks', queryParams: { status: 'selfAssigned' }, icon: 'tasks' },
        { label: 'Task Requests', route: '/task-requests', queryParams: { status: 'PENDING' }, icon: 'approvals' }
      ];
    } else if (r === 'TEACHER') {
      // Primary Links (All of them)
      this.primaryLinks = [
        { label: 'Dashboard', route: '/teacher', icon: 'dashboard' },
        { label: 'My Tasks', route: '/view-tasks', queryParams: { view: 'Self' }, icon: 'tasks' },
        { label: 'Requests', route: '/task-requests', icon: 'approvals' }
      ];
      this.moreLinks = []; // Empty, only Profile and Logout will show in bottom sheet
    }
  }
}
