import { Component, OnInit, OnDestroy, ElementRef, Renderer2, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationDto } from '../../../Model/NotificationDto';
import { NotificationService } from '../../../Services/notification-service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, DatePipe,FormsModule],
  templateUrl: './notification-bell-component.html',
  styleUrls: ['./notification-bell-component.css']
})
export class NotificationBellComponent implements OnInit, OnDestroy, AfterViewInit {
  unread: NotificationDto[] = [];
  isOpen = false;
  bellPulse = false;
  private subs: Subscription[] = [];
  private clickListener!: () => void;
  private dropdownElement!: HTMLElement;

  constructor(
    private notif: NotificationService,
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.notif.unread$.subscribe(list => this.unread = list),
      this.notif.incoming$.subscribe(() => this.triggerPulse())
    );

    // close when clicking outside
    this.clickListener = this.renderer.listen('document', 'click', (ev) => {
      if (!this.el.nativeElement.contains(ev.target)) {
        this.isOpen = false;
        document.body.classList.remove('notif-dropdown-open');
      }
    });
  }

  ngAfterViewInit(): void {
    this.dropdownElement = this.el.nativeElement.querySelector('.notif-dropdown');
    this.moveDropdownToBody();
    this.updateDropdownPosition();

    // Update position on window resize
    window.addEventListener('resize', () => this.updateDropdownPosition());
  }

  moveDropdownToBody(): void {
    if (this.dropdownElement && this.dropdownElement.parentNode !== document.body) {
      document.body.appendChild(this.dropdownElement);
    }
  }

  updateDropdownPosition(): void {
    if (this.dropdownElement) {
      const rect = this.el.nativeElement.getBoundingClientRect();
      this.renderer.setStyle(this.dropdownElement, 'position', 'fixed');
      this.renderer.setStyle(this.dropdownElement, 'top', (rect.bottom + 4) + 'px');
      this.renderer.setStyle(this.dropdownElement, 'right', (window.innerWidth - rect.right) + 'px');
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      document.body.classList.add('notif-dropdown-open');
      this.updateDropdownPosition();
    } else {
      document.body.classList.remove('notif-dropdown-open');
    }
  }

  triggerPulse() {
    this.bellPulse = true;
    setTimeout(() => this.bellPulse = false, 800);
  }

  open(n: NotificationDto) {
    this.notif.markAsRead(n.id!);
    this.isOpen = false;
    document.body.classList.remove('notif-dropdown-open');
  }

  markAll() {
    this.notif.markAllAsRead();
    this.isOpen = false;
    document.body.classList.remove('notif-dropdown-open');
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.clickListener();
    
    // Remove dropdown from body when component is destroyed
    if (this.dropdownElement && this.dropdownElement.parentNode === document.body) {
      document.body.removeChild(this.dropdownElement);
    }
    
    // Remove window resize listener
    window.removeEventListener('resize', () => this.updateDropdownPosition());
  }
}