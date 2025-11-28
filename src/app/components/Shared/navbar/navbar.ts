import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthApiService } from '../../../Services/auth-api-service';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { ToastContainerComponent } from '../toast-container-component/toast-container-component';

// ✅ ADD THESE


@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    NotificationBellComponent,   // ✅
    ToastContainerComponent      // ✅
  ]
})
export class Navbar {
  isMenuOpen = false;
  isLoggedIn$: Observable<boolean>;

  constructor(
    private authService: AuthApiService,
    private router: Router
  ) {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
  }

  onHomeClick() {
    this.authService.goToDashboard();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

 // In your logout button handler
logout(): void {
  const refreshToken = this.authService.getRefreshToken() ?? undefined; // normalize null to undefined
  this.authService.logout(refreshToken).subscribe({
    next: () => this.router.navigate(['/login']),
    error: () => this.router.navigate(['/login']) // still redirect
  });
}
}
