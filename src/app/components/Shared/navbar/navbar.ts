import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthApiService } from '../../../Services/auth-api-service';
import { NotificationBellComponent } from '../notification-bell-component/notification-bell-component';
import { ToastContainerComponent } from '../toast-container-component/toast-container-component';
import { NgOptimizedImage } from '@angular/common';


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
    ToastContainerComponent,
    NgOptimizedImage
  ]
})
export class Navbar {
  isMenuOpen = false;
  isLoggedIn = false;
  isLoggedIn$: Observable<boolean>;
  isLoginPage$: Observable<boolean>;

  constructor(
    private authService: AuthApiService,
    private router: Router
  ) {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
    this.authService.isLoggedIn$.subscribe(val => this.isLoggedIn = val);
    
    this.isLoginPage$ = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.url === '/login' || event.urlAfterRedirects === '/login')
    );
  }

  onHomeClick() {
    console.log("Home clicked");
    if (!this.isLoggedIn) {
      console.log("Not logged in, navigating to /");
      this.router.navigate(['/']);
    }

    else {
      console.log("Logged in, navigating to /dashboard");
      this.authService.goToDashboard();
    }

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
