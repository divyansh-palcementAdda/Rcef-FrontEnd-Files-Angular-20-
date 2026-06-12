import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { UserApiService } from '../../../Services/UserApiService';
import { JwtService } from '../../../Services/jwt-service';

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

  constructor(
    private authService: AuthApiService,
    private router: Router,
    private userApiService: UserApiService,
    private jwtService: JwtService
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

  logout(): void {
    const refreshToken = this.authService.getRefreshToken() ?? undefined;
    this.authService.logout(refreshToken).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
