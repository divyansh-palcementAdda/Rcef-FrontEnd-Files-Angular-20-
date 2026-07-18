import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { UserApiService } from '../../../Services/UserApiService';
import { userDto } from '../../../Model/userDto';
import { JwtService } from '../../../Services/jwt-service';
import { SidebarService } from '../../../Services/sidebar-service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, NotificationBellComponent],
  templateUrl: './topbar.html',
  styleUrls: ['./topbar.css']
})
export class TopbarComponent implements OnInit {
  username: string = 'User';
  fullName: string = 'User';
  role: string | null = null;
  currentDate = new Date();
  userProfile: userDto | null = null;
  profileDropdownOpen = false;

  constructor(
    private authService: AuthApiService,
    private router: Router,
    private userApiService: UserApiService,
    private jwtService: JwtService,
    private sidebarService: SidebarService,
    private elRef: ElementRef
  ) { }

  ngOnInit(): void {
    this.authService.username$.subscribe(name => {
      this.username = name;
      if (!this.fullName || this.fullName === 'User' || this.fullName.includes('@')) {
        this.fullName = this.formatName(name);
      }
    });
    this.role = this.authService.getCurrentRole();
    this.loadUserProfile();
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
            this.userProfile = user;
          },
          error: (err) => console.warn('Failed to load user profile in topbar:', err)
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

  getGreetingTime(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  getShortGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'GM';
    if (hour < 17) return 'GA';
    return 'GE';
  }

  getShortName(): string {
    if (!this.fullName) return 'U';
    const parts = this.fullName.split(' ');
    if (parts.length >= 2) {
      return parts.map(p => p.charAt(0).toUpperCase()).join(' ');
    }
    return this.fullName.substring(0, 2).toUpperCase();
  }

  isSmallScreen(): boolean {
    return window.innerWidth <= 320;
  }

  toggleSidebar(): void {
    if (window.innerWidth < 768) {
      this.sidebarService.toggleMobileSidebar();
    } else {
      this.sidebarService.toggleCollapsed();
    }
  }

  toggleProfileDropdown(): void {
    this.profileDropdownOpen = !this.profileDropdownOpen;
  }

  navigateToProfile(): void {
    const token = this.authService.getAccessToken();
    const userId = this.userProfile?.userId || (token ? this.jwtService.getUserIdFromToken(token) : null);
    if (userId) {
      this.profileDropdownOpen = false;
      this.router.navigate(['/user', userId]);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.profileDropdownOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.profileDropdownOpen = false;
  }

  logout(): void {
    const refreshToken = this.authService.getRefreshToken() ?? undefined;
    this.authService.logout(refreshToken).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
