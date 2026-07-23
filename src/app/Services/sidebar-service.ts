import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isMobileOpenSubject = new BehaviorSubject<boolean>(false);
  isMobileOpen$ = this.isMobileOpenSubject.asObservable();

  private isCollapsedSubject = new BehaviorSubject<boolean>(false);
  isCollapsed$ = this.isCollapsedSubject.asObservable();

  constructor() {
    this.checkScreenSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.checkScreenSize());
    }
  }

  private checkScreenSize(): void {
    if (typeof window === 'undefined') return;
    const width = window.innerWidth;
    if (width < 768) {
      // Mobile: hidden by default, not collapsed
      this.isMobileOpenSubject.next(false);
      this.isCollapsedSubject.next(false);
    } else if (width >= 768 && width < 1200) {
      // Tablet: collapsible, starts collapsed
      this.isMobileOpenSubject.next(false);
      this.isCollapsedSubject.next(true);
    } else {
      // Desktop: expanded, not collapsed
      this.isMobileOpenSubject.next(false);
      this.isCollapsedSubject.next(false);
    }
  }

  toggleMobileSidebar(): void {
    this.isMobileOpenSubject.next(!this.isMobileOpenSubject.value);
  }

  setMobileSidebarOpen(open: boolean): void {
    this.isMobileOpenSubject.next(open);
  }

  toggleCollapsed(): void {
    this.isCollapsedSubject.next(!this.isCollapsedSubject.value);
  }

  setCollapsed(collapsed: boolean): void {
    this.isCollapsedSubject.next(collapsed);
  }

  /** Get current mobile open state */
  getIsMobileOpen(): boolean {
    return this.isMobileOpenSubject.value;
  }

  /** Get current collapsed state */
  getIsCollapsed(): boolean {
    return this.isCollapsedSubject.value;
  }
}
