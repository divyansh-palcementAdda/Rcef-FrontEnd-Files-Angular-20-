import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserApiService } from '../../../Services/UserApiService';
import { TaskApiService } from '../../../Services/task-api-Service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface ImportSummary {
  totalRows: number;
  imported: number;
  failed: number;
  durationMs: number;
}

interface BulkImportResponse {
  success: boolean;
  message: string;
  summary: ImportSummary;
  errorReportAvailable: boolean;
  errorReportDownloadUrl: string;
}

@Component({
  selector: 'app-bulk-upload',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  templateUrl: './bulk-upload.html',
  styleUrls: ['./bulk-upload.css']
})
export class BulkUploadComponent implements OnInit {
  @Input() importType: 'USER' | 'TASK' = 'USER';
  @Input() title = 'Bulk Upload';
  @Output() importCompleted = new EventEmitter<void>();

  selectedFile: File | null = null;

  dragOver = false;
  uploading = false;
  uploadProgress = 'Uploading...';
  
  resultSummary: ImportSummary | null = null;
  errorReportAvailable = false;
  errorReportJobId: string | null = null;
  
  historyList: any[] = [];
  loadingHistory = false;

  constructor(
    private userApiService: UserApiService,
    private taskApiService: TaskApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loadingHistory = true;
    this.userApiService.getImportHistory().subscribe({
      next: (res: any[]) => {
        this.historyList = res.filter(h => h.importType === this.importType);
        this.loadingHistory = false;
      },
      error: (err) => {
        this.showError('Failed to load import history');
        this.loadingHistory = false;
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    this.handleFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.handleFile(file);
    }
  }

  handleFile(file: File): void {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      this.showError('Only Excel files (.xlsx, .xls) are allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      this.showError('File size exceeds the 10MB limit.');
      return;
    }
    this.selectedFile = file;
    this.resultSummary = null;
    this.errorReportAvailable = false;
    this.errorReportJobId = null;
  }

  downloadTemplate(): void {
    const obs = this.importType === 'USER' 
      ? this.userApiService.downloadImportTemplate()
      : this.taskApiService.downloadImportTemplate();

    obs.subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.importType.toLowerCase()}_import_template.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => this.showError('Failed to download template.')
    });
  }

  uploadFile(): void {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.uploadProgress = 'Uploading & Processing...';

    const obs = this.importType === 'USER'
      ? this.userApiService.importUsers(this.selectedFile)
      : this.taskApiService.importTasks(this.selectedFile);

    obs.subscribe({
      next: (res: BulkImportResponse) => {
        this.uploading = false;
        this.selectedFile = null;
        if (res.success) {
          this.resultSummary = res.summary;
          this.errorReportAvailable = res.errorReportAvailable;
          if (res.errorReportAvailable && res.errorReportDownloadUrl) {
            const parts = res.errorReportDownloadUrl.split('/');
            this.errorReportJobId = parts[parts.length - 1];
          }
          this.snackBar.open('Import completed successfully.', 'Close', { duration: 4000 });
          this.importCompleted.emit();
          this.loadHistory();

        } else {
          this.showError(res.message || 'Import failed.');
        }
      },
      error: (err) => {
        this.uploading = false;
        this.showError(err.message || 'Error occurred during upload.');
      }
    });
  }

  downloadErrorReport(jobId?: string): void {
    const id = jobId || this.errorReportJobId;
    if (!id) return;

    const obs = this.importType === 'USER'
      ? this.userApiService.downloadImportErrorReport(id)
      : this.taskApiService.downloadImportErrorReport(id);

    obs.subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.importType.toLowerCase()}_import_errors_${id}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => this.showError('Failed to download error report.')
    });
  }

  removeFile(): void {
    this.selectedFile = null;
  }

  showError(msg: string): void {
    this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: ['snackbar-error'] });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString();
  }
}
