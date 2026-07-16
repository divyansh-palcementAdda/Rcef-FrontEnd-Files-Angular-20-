import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BulkUploadComponent } from '../../Shared/bulk-upload/bulk-upload';

@Component({
  selector: 'app-users-import',
  standalone: true,
  imports: [CommonModule, BulkUploadComponent],
  template: `<app-bulk-upload importType="USER" title="Bulk User Import"></app-bulk-upload>`
})
export class UsersImportComponent {}
