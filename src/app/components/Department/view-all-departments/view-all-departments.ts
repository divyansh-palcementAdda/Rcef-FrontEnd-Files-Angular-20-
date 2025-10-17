import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Department } from '../../../Model/department';
import { DepartmentApiService } from '../../../Services/department-api-service';


@Component({
  selector: 'app-view-departments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-all-departments.html',
  styleUrls: ['./view-all-departments.css'],
})
export class ViewDepartmentsComponent implements OnInit {

  departments: Department[] = [];
  filteredDepartments: Department[] = [];

  loading = false;
  errorMessage: string | null = null;

  searchTerm = '';
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;

  constructor(
    private apiService: DepartmentApiService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadAllDepartments();
  }

  private loadAllDepartments(): void {
  this.loading = true;
  this.apiService.getAllDepartments().subscribe({
    next: (res: Department[]) => this.handleDepartmentResponse(res || []),
    error: err => this.handleError(err, 'Failed to load departments.')
  });
}


  private handleDepartmentResponse(depts: Department[]): void {
    this.departments = depts || [];
    console.log(depts)
    this.applyFilters();
    this.loading = false;
  }

  private handleError(err: any, fallback: string): void {
    console.error(err);
    this.errorMessage = err?.error?.message || fallback;
    this.loading = false;
  }

  applyFilters(): void {
    this.filteredDepartments = this.departments.filter(d =>
      !this.searchTerm || d.name?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );

    this.totalPages = Math.ceil(this.filteredDepartments.length / this.pageSize) || 1;
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

  get paginatedDepartments(): Department[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredDepartments.slice(start, start + this.pageSize);
  }

  viewDepartmentDetails(departmentId?: number): void {
    if (departmentId) this.router.navigate(['/departments', departmentId]);
  }

  deleteDepartment(event: Event, departmentId?: number): void {
    event.stopPropagation();
    if (!departmentId) return;

    if (!confirm('Are you sure you want to delete this department?')) return;

    this.apiService.deleteDepartment(departmentId).subscribe({
      next: () => {
        this.departments = this.departments.filter(d => d.departmentId !== departmentId);
        this.applyFilters();
      },
      error: err => this.handleError(err, 'Failed to delete department.')
    });
  }
}
