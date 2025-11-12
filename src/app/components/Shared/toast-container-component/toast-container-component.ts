import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastData, ToastService } from '../../../Services/ToastData';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './toast-container-component.html',
  styleUrls: ['./toast-container-component.css']
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: ToastData[] = [];
  private sub!: Subscription;

  constructor(private ts: ToastService, private router: Router) {}

  ngOnInit() {
    this.sub = this.ts.toasts$.subscribe(t => {
      if (t) {
        this.toasts = [t, ...this.toasts];
        setTimeout(() => this.close(t), 5000);
      }
    });
  }

  openTask(t: ToastData) {
    if (t.taskId) this.router.navigate(['/view-task', t.taskId]);
    this.close(t);
  }

  close(t: ToastData) {
    this.toasts = this.toasts.filter(x => x !== t);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}