import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthApiService } from '../../../Services/auth-api-service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
  standalone: true,
  imports: [RouterModule, CommonModule]
})
export class Navbar {
  isMenuOpen = false;
  isLoggedIn$: Observable<boolean>;

  constructor(private authService: AuthApiService) {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  logout() {
    this.authService.logout();
    this.closeMenu();
  }
}
