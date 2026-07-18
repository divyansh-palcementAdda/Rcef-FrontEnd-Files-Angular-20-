import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalManagerService } from '../../../Services/modal-manager.service';

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

  constructor(private modalService: ModalManagerService) {}

  ngOnInit(): void {
    this.previousActiveElement = document.activeElement as HTMLElement;
    this.modalService.register(this);
    
    // Set focus to the modal dialog for keyboard interaction & focus trap
    setTimeout(() => {
      if (this.modalDialog) {
        this.modalDialog.nativeElement.focus();
      }
    }, 50);
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
      this.onCloseClick();
    }
  }

  onCloseClick(): void {
    this.close.emit();
  }

  onBackClick(): void {
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
