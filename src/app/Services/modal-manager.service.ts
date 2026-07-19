import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalManagerService {
  private activeModals: any[] = [];
  private activeModalsSubject = new BehaviorSubject<any[]>([]);
  activeModals$ = this.activeModalsSubject.asObservable();

  register(modal: any): void {
    this.activeModals.push(modal);
    this.activeModalsSubject.next([...this.activeModals]);
    this.updateBodyScroll();
  }

  unregister(modal: any): void {
    this.activeModals = this.activeModals.filter(m => m !== modal);
    this.activeModalsSubject.next([...this.activeModals]);
    this.updateBodyScroll();
  }

  getActiveModals(): any[] {
    return this.activeModals;
  }

  isTopModal(modal: any): boolean {
    return this.activeModals[this.activeModals.length - 1] === modal;
  }

  isFirstModal(modal: any): boolean {
    return this.activeModals[0] === modal;
  }

  getZIndex(modal: any): number {
    const index = this.activeModals.indexOf(modal);
    return index >= 0 ? 1050 + index * 10 : 1050;
  }

  private updateBodyScroll(): void {
    if (this.activeModals.length > 0) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
    }
  }
}
