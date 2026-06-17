import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  ConfirmDialogService,
  ConfirmDialogEvent,
} from '../../../Services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css'],
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  visible = false;
  current: ConfirmDialogEvent | null = null;

  private sub!: Subscription;

  constructor(private confirmService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.sub = this.confirmService.dialog$.subscribe((event) => {
      if (event) {
        this.current = event;
        this.visible = true;
      }
    });
  }

  get type(): string {
    return this.current?.options?.type || 'danger';
  }

  get title(): string {
    const defaults: Record<string, string> = {
      danger: 'Confirm Delete',
      warning: 'Confirm Action',
      info: 'Confirm',
    };
    return this.current?.options?.title || defaults[this.type] || 'Confirm';
  }

  get iconClass(): string {
    const map: Record<string, string> = {
      danger: 'bi-trash3-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill',
    };
    return map[this.type] || 'bi-question-circle-fill';
  }

  get iconBgClass(): string {
    const map: Record<string, string> = {
      danger: 'icon-bg-danger',
      warning: 'icon-bg-warning',
      info: 'icon-bg-info',
    };
    return map[this.type] || 'icon-bg-danger';
  }

  get confirmBtnClass(): string {
    const map: Record<string, string> = {
      danger: 'btn-confirm-danger',
      warning: 'btn-confirm-warning',
      info: 'btn-confirm-info',
    };
    return map[this.type] || 'btn-confirm-danger';
  }

  confirm(): void {
    if (this.current) {
      this.current.resolve(true);
    }
    this.close();
  }

  cancel(): void {
    if (this.current) {
      this.current.resolve(false);
    }
    this.close();
  }

  private close(): void {
    this.visible = false;
    this.current = null;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
