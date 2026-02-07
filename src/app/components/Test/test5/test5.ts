
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Department } from '../../../Model/department';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';

@Component({
  selector: 'app-test5',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './test5.html',
  styleUrl: './test5.css',
})
export class Test5 implements OnInit, OnDestroy {
  // Department Data
  departments: Department[] = [];
  filteredDepartments: Department[] = [];
  readonly Math = Math; // Expose Math to template for pagination calculations
  // UI State
  loading = false;
  errorMessage: string | null = null;
  isZeroDueView = false;
  
  // Search & Filter
  searchTerm = '';
  
  // Pagination
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;
  totalItems = 0;
  
  // Responsive
  isMobileView = false;
  
  // Subscriptions
  private subscriptions = new Subscription();

  constructor(
    private apiService: DepartmentApiService,
    private router: Router,
    private jwtService: JwtService,
    private authApiService: AuthApiService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.checkViewport();
    window.addEventListener('resize', () => this.checkViewport());
    
    this.subscriptions.add(
      this.route.queryParams.subscribe(params => {
        const filter = params['filter'];
        this.isZeroDueView = filter === 'ZERO_DUE';
        
        if (this.isZeroDueView) {
          this.loadZeroDueDepartments();
        } else {
          this.loadAllDepartments();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    window.removeEventListener('resize', () => this.checkViewport());
  }

  private checkViewport(): void {
    this.isMobileView = window.innerWidth < 768;
  }

  private loadZeroDueDepartments(): void {
    this.loading = true;
    this.errorMessage = null;

    this.subscriptions.add(
      this.apiService.getZeroDueDepartmentsAsObjects().subscribe({
        next: (response: any) => {
          const departmentsArray = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
            ? response.data
            : [];

          this.handleDepartmentResponseforZero(departmentsArray);
          this.isZeroDueView = true;
        },
        error: (err) => {
          this.handleError(err, 'Failed to load departments with zero due tasks.');
        }
      })
    );
  }

  private handleDepartmentResponseforZero(depts: any): void {
    let safeList: Department[] = [];
    if (Array.isArray(depts)) {
      safeList = depts;
    } else if (depts && Array.isArray(depts.data)) {
      safeList = depts.data;
    }
    this.departments = safeList;
    this.applyFilters();
    this.loading = false;
  }

  private loadAllDepartments(): void {
    this.loading = true;
    this.errorMessage = null;

    this.subscriptions.add(
      this.apiService.getAllDepartments().subscribe({
        next: (res: Department[]) => {
          this.handleDepartmentResponse(res || []);
        },
        error: (err) => {
          this.handleError(err, 'Failed to load departments.');
        }
      })
    );
  }

  private handleDepartmentResponse(depts: Department[]): void {
    this.departments = depts || [];
    this.applyFilters();
    this.loading = false;
  }

  private handleError(err: any, fallback: string): void {
    console.error(err);
    this.errorMessage = err?.error?.message || fallback;
    this.loading = false;
    
    // Auto-dismiss error after 5 seconds
    setTimeout(() => {
      this.errorMessage = null;
    }, 5000);
  }

  // Filter Methods
  applyFilters(): void {
    let filtered = this.departments;
    
    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(dept =>
        dept.name?.toLowerCase().includes(term) ||
        dept.description?.toLowerCase().includes(term) ||
        dept.departmentStatus?.toLowerCase().includes(term)
      );
    }
    
    this.filteredDepartments = filtered;
    this.totalItems = filtered.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    
    // Reset to first page if current page is invalid
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.applyFilters();
  }

  // Pagination Methods
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = this.isMobileView ? 3 : 5;
    
    let start = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let end = Math.min(this.totalPages, start + maxVisiblePages - 1);
    
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  get paginatedDepartments(): Department[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredDepartments.slice(start, end);
  }

  // Navigation Methods
  goBackToDashboard(): void {
    const token = this.jwtService.getAccessToken();
    if (token) {
      this.authApiService.goToDashboard();
    } else {
      this.router.navigate(['/login']);
    }
  }

  viewDepartmentDetails(departmentId?: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (departmentId) {
      this.router.navigate(['/department', departmentId]);
    }
  }

  deleteDepartment(event: Event, departmentId?: number): void {
    event.stopPropagation();
    
    if (!departmentId) {
      return;
    }

    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      return;
    }

    this.subscriptions.add(
      this.apiService.deleteDepartment(departmentId).subscribe({
        next: () => {
          this.departments = this.departments.filter(d => d.departmentId !== departmentId);
          this.applyFilters();
          
          // Show success feedback
          setTimeout(() => {
            // Could add a toast notification here
          }, 300);
        },
        error: (err) => {
          this.handleError(err, 'Failed to delete department. Please try again.');
        }
      })
    );
  }

  // Helper Methods
  getStatusClass(status: string): string {
    if (!status) return 'status-inactive';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('active')) return 'status-active';
    if (statusLower.includes('inactive')) return 'status-inactive';
    if (statusLower.includes('pending')) return 'status-pending';
    
    return 'status-inactive';
  }

  getShortDescription(description: string, maxLength: number = 100): string {
    if (!description) return 'No description available';
    
    if (description.length <= maxLength) {
      return description;
    }
    
    return description.substring(0, maxLength) + '...';
  }
}