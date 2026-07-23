import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ModalManagerService } from '../../../Services/modal-manager.service';
import { AuthorizationService } from '../../../Services/authorization.service';
import { SidebarService } from '../../../Services/sidebar-service';

@Component({
  selector: 'app-modal-wrapper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-wrapper.html',
  styleUrls: ['./modal-wrapper.css']
})
export class ModalWrapperComponent implements OnInit, OnDestroy {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() sizeClass: string = 'modal-md'; // modal-sm, modal-md, modal-lg, modal-xl
  @Input() showBackButton: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  @ViewChild('modalDialog') modalDialog!: ElementRef<HTMLElement>;

  private previousActiveElement: HTMLElement | null = null;

  private readonly router = inject(Router);
  private readonly authService = inject(AuthorizationService);
  private readonly sidebarService = inject(SidebarService);

  constructor(private modalService: ModalManagerService) {}

  @HostListener('click', ['$event'])
  onModalClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // 1. Avoid triggering row navigation when clicking buttons, anchors, inputs, dropdowns, etc.
    if (target.closest('button, a, input, select, textarea, [role="button"], .btn, .dropdown-item, .dropdown-toggle')) {
      return;
    }

    // 2. Find closest clickable row annotated with data-row-type and class 'clickable-row'
    const clickableRow = target.closest('.clickable-row[data-row-type]');
    if (clickableRow) {
      const rowType = clickableRow.getAttribute('data-row-type');
      const rowId = clickableRow.getAttribute('data-row-id');

      if (rowType && rowId) {
        this.handleRowNavigation(rowType, rowId, event);
      }
    }
  }

  private handleRowNavigation(type: string, id: any, event: MouseEvent): void {
    const isCtrlClick = event.ctrlKey || event.metaKey || event.button === 1;

    // RBAC Permission Check
    if (type === 'user') {
      const currentRole = this.authService.getCurrentUser()?.role || '';
      const hasPermission = this.authService.hasPermission('USER_VIEW') && currentRole !== 'TEACHER';
      if (!hasPermission) return;
    } else if (type === 'task') {
      const hasPermission = this.authService.hasPermission('TASK_VIEW');
      if (!hasPermission) return;
    }

    // Navigate to the appropriate detail route
    const numericId = parseInt(id, 10);
    const resolvedId = isNaN(numericId) ? id : numericId;

    if (type === 'user') {
      if (isCtrlClick) {
        window.open(`/user/${resolvedId}`, '_blank');
      } else {
        this.router.navigate(['/user', resolvedId]);
      }
    } else if (type === 'task') {
      if (isCtrlClick) {
        window.open(`/task/${resolvedId}`, '_blank');
      } else {
        this.router.navigate(['/task', resolvedId]);
      }
    }
  }

  ngOnInit(): void {
    this.previousActiveElement = document.activeElement as HTMLElement;
    this.modalService.register(this);
    
    // Auto-close mobile sidebar when modal opens for better UX
    this.sidebarService.setMobileSidebarOpen(false);
    
    // Set focus to the modal dialog for keyboard interaction & focus trap
    requestAnimationFrame(() => {
      if (this.modalDialog) {
        this.modalDialog.nativeElement.focus();
      }
    });
  }

  ngOnDestroy(): void {
    this.modalService.unregister(this);
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

  get zIndex(): number {
    return this.modalService.getZIndex(this);
  }

  get isTopModal(): boolean {
    return this.modalService.isTopModal(this);
  }

  get isFirstModal(): boolean {
    return this.modalService.isFirstModal(this);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      event.stopPropagation();
      this.onCloseClick(event);
    }
  }

  onCloseClick(event?: MouseEvent): void {
    event?.stopPropagation();
    this.close.emit();
  }

  onBackClick(event?: MouseEvent): void {
    event?.stopPropagation();
    this.back.emit();
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.isTopModal) {
      this.onCloseClick();
    }
  }

  onDialogKeydown(event: KeyboardEvent): void {
    if (!this.isTopModal) return;
    
    // Focus Trap: Tab key looping
    if (event.key === 'Tab') {
      const focusableElements = this.modalDialog.nativeElement.querySelectorAll(
        'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
      );
      
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          event.preventDefault();
        }
      }
    }
  }
}
