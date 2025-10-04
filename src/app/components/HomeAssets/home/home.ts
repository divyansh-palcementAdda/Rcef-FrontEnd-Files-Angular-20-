import { CommonModule } from '@angular/common';
import { Token } from '@angular/compiler';
import { Component, OnInit, HostListener } from '@angular/core';
import { LoginComponent } from '../../Auth/login/login';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  standalone: true,
  imports: [CommonModule, RouterLink]
})
export class Home implements OnInit {
  particles: number[] = Array(30).fill(0).map((_, i) => i);
  constructor(private router: Router, private authService: AuthApiService) {}

  ngOnInit() {
    this.initAnimations();
  }

  private initAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('animate-visible');
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-slide-up, .animate-fade-in')
      .forEach(el => observer.observe(el));
  }

  @HostListener('window:scroll')
  handleScroll() {
    const scrollPosition = window.scrollY;
    document.querySelectorAll('.hero-parallax').forEach(el => {
      (el as HTMLElement).style.transform = `translateY(${scrollPosition * 0.5}px)`;
    });
  }
  // constructor(private router: Router, private loginComponent: LoginComponent) {}

  dashboard() {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.authService.dashboard(payload);
    } else {
      this.router.navigate(['/login']);
    }
  }

}
