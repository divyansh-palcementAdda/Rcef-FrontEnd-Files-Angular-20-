import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BulkUploadComponent } from '../../Shared/bulk-upload/bulk-upload';

@Component({
  selector: 'app-tasks-import',
  standalone: true,
  imports: [CommonModule, BulkUploadComponent],
  template: `<app-bulk-upload importType="TASK" title="Bulk Task Import" (importCompleted)="onImportCompleted()"></app-bulk-upload>`
})
export class TasksImportComponent {
  @Output() importCompleted = new EventEmitter<void>();

  onImportCompleted(): void {
    this.importCompleted.emit();
  }
}
