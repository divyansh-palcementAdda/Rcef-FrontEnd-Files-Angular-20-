import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './access-denied.html',
  styleUrls: ['./access-denied.css']
})
export class AccessDeniedComponent {
  private readonly authService = inject(AuthApiService);
  private readonly router = inject(Router);

  goHome(): void {
    this.authService.goToDashboard();
  }
}
