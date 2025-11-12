import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastData {
  title: string;
  message: string;
  taskId?: number;
  timestamp?: Date;          // required for the template
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private src = new BehaviorSubject<ToastData | null>(null);
  toasts$ = this.src.asObservable();

  show(data: Omit<ToastData, 'timestamp'>) {
    this.src.next({ ...data, timestamp: new Date() });
  }
}