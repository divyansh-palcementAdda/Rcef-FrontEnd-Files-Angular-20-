import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalService } from '../../../Services/modal-service';

interface SubDepartment {
  id: string;
  name: string;
  code: string;
  description: string;
  department?: {
    departmentId: number;
    name: string;
  };
  status?: 'ACTIVE' | 'INACTIVE';
}

@Component({
  selector: 'app-view-all-sub-departments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-all-sub-departments.html',
  styleUrls: ['./view-all-sub-departments.css'],
})
export class ViewAllSubDepartmentsComponent implements OnInit {

  subDepartments: SubDepartment[] = [];
  filteredSubDepartments: SubDepartment[] = [];

  loading = false;
  errorMessage: string | null = null;
  searchTerm = '';
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;
  private subscriptions = new Subscription();
  private confirmDialogService = inject(ConfirmDialogService);

  constructor(
    private apiService: DepartmentApiService,
    private router: Router,
    private jwtService: JwtService,
    private authApiService: AuthApiService,
    private route: ActivatedRoute,
    private location: Location
  ) {
    inject(ModalService).modalClosed$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.success) {
        this.loadAllSubDepartments();
      }
    });
  }

  ngOnInit(): void {
    this.loadAllSubDepartments();
  }

  private loadAllSubDepartments(): void {
    this.loading = true;
    this.errorMessage = null;

    this.apiService.getAllSubDepartments().subscribe({
      next: (res: any[]) => {
        const activeSubDepartments = (res || []).filter(
          sub => sub.status === 'ACTIVE' || !sub.status
        );
        this.handleSubDepartmentResponse(activeSubDepartments);
      },
      error: err => this.handleError(err, 'Failed to load sub-departments.')
    });
  }

  private handleSubDepartmentResponse(subs: SubDepartment[]): void {
    this.subDepartments = subs || [];
    this.applyFilters();
    this.loading = false;
  }

  private handleError(err: any, fallback: string): void {
    console.error(err);
    this.errorMessage = err?.error?.message || fallback;
    this.loading = false;
  }

  applyFilters(): void {
    this.filteredSubDepartments = this.subDepartments.filter(s =>
      !this.searchTerm || 
      s.name?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      s.code?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      s.department?.name?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );

    this.totalPages = Math.ceil(this.filteredSubDepartments.length / this.pageSize) || 1;
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedSubDepartments(): SubDepartment[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredSubDepartments.slice(start, start + this.pageSize);
  }

  viewSubDepartmentDetails(id: string): void {
    this.router.navigate(['/sub-department-details', id]);
  }

  editSubDepartment(event: Event, id: string): void {
    event.stopPropagation();
    this.router.navigate(['/sub-departments']);
  }

  deleteSubDepartment(event: Event, id: string): void {
    event.stopPropagation();
    if (!id) return;

    this.confirmDialogService.confirm({
      title: 'Delete Sub Department',
      message: 'This action will permanently delete this Sub Department and all related data, including users, tasks, task requests, proofs, activities, mappings, and other associated records.\n\nThis action cannot be undone and the deleted data cannot be restored.\n\nAre you sure you want to continue?',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      type: 'danger'
    }).then((confirmed) => {
      if (confirmed) {
        this.apiService.deleteSubDepartment(id).subscribe({
          next: () => {
            this.subDepartments = this.subDepartments.filter(s => s.id !== id);
            this.applyFilters();
          },
          error: err => this.handleError(err, 'Failed to delete sub-department.')
        });
      }
    });
  }

  goBackToDashboard() {
    this.location.back();
  }
}
