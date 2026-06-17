import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export interface ConfirmDialogEvent {
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private dialogSubject = new Subject<ConfirmDialogEvent | null>();
  dialog$ = this.dialogSubject.asObservable();

  confirm(options: ConfirmDialogOptions | string): Promise<boolean> {
    const opts: ConfirmDialogOptions =
      typeof options === 'string' ? { message: options } : options;

    return new Promise<boolean>((resolve) => {
      this.dialogSubject.next({ options: opts, resolve });
    });
  }
}
