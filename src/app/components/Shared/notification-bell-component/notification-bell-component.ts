import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
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
export class NotificationBellComponent implements OnInit, OnDestroy {
  unread: NotificationDto[] = [];
  isOpen = false;
  bellPulse = false;
  private subs: Subscription[] = [];
  private clickListener!: () => void;

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
      if (!this.el.nativeElement.contains(ev.target)) this.isOpen = false;
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  triggerPulse() {
    this.bellPulse = true;
    setTimeout(() => this.bellPulse = false, 800);
  }

  open(n: NotificationDto) {
    this.notif.markAsRead(n.id!);
    this.isOpen = false;
  }

  markAll() {
    this.notif.markAllAsRead();
    this.isOpen = false;
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.clickListener();
  }
}