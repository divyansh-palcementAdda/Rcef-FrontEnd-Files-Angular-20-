import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Department } from '../../../Model/department';
import { SubDepartmentResponse } from '../../../Model/sub-department';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalService } from '../../../Services/modal-service';

// Card colours cycling for dynamic department cards
const CARD_COLORS = [
  { bg: '#e8f0fe', icon: '#3d6fd4', iconClass: 'bi-building'        },
  { bg: '#e6f9f0', icon: '#1db06a', iconClass: 'bi-person-plus-fill' },
  { bg: '#fff4e5', icon: '#e08c00', iconClass: 'bi-mortarboard-fill' },
  { bg: '#f3eeff', icon: '#7c4dff', iconClass: 'bi-headset'          },
  { bg: '#fde8e8', icon: '#d43d3d', iconClass: 'bi-people-fill'      },
  { bg: '#e8f9fd', icon: '#0d9aaf', iconClass: 'bi-diagram-2-fill'   },
];

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

  // ── Card / sub-dept state ─────────────────────────────────────────────────
  selectedDept: Department | null = null;   // null = "All Departments" view
  subDepts: SubDepartmentResponse[] = [];
  filteredSubDepts: SubDepartmentResponse[] = [];
  subDeptLoading = false;
  subDeptError: string | null = null;
  subDeptSearchTerm = '';

  // sub-dept pagination
  subDeptCurrentPage = 1;
  subDeptPageSize    = 8;
  subDeptTotalPages  = 1;

  // ── All Sub-Departments panel state ──────────────────────────────────────
  showAllSubDepts = false;
  allSubDepts: SubDepartmentResponse[] = [];
  filteredAllSubDepts: SubDepartmentResponse[] = [];
  allSubDeptsLoading = false;
  allSubDeptsError: string | null = null;
  allSubDeptsSearchTerm = '';
  allSubDeptsCurrentPage = 1;
  allSubDeptsPageSize    = 10;
  allSubDeptsTotalPages  = 1;

  // ── Add Sub-Department Modal state ────────────────────────────────────────
  showAddSubDeptModal = false;
  addSubDeptSaving = false;
  addSubDeptError: string | null = null;
  addSubDeptSuccess: string | null = null;
  addSubDeptForm = { name: '', code: '', description: '', departmentId: null as number | null };

  // ── Edit Sub-Department Modal state ───────────────────────────────────────
  showEditModal = false;
  editSubDeptId: string | null = null;
  editSubDeptSaving = false;
  editSubDeptError: string | null = null;
  editSubDeptSuccess: string | null = null;
  editForm = { name: '', code: '', description: '', departmentId: null as number | null };

  // card colour helper
  cardColor(index: number) { return CARD_COLORS[index % CARD_COLORS.length]; }

  // ── Dept-table state ──────────────────────────────────────────────────────
  loading = false;
  errorMessage: string | null = null;
  isZeroDueView = false;
  searchTerm = '';
  currentPage = 1;
  pageSize = 8;
  totalPages = 1;

  private subscriptions = new Subscription();
  private confirmDialogService = inject(ConfirmDialogService);

  constructor(
    private apiService: DepartmentApiService,
    public router: Router,
    private jwtService: JwtService,
    private authApiService: AuthApiService,
    private route: ActivatedRoute
  ) {
    inject(ModalService).modalClosed$.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.success) {
        if (this.isZeroDueView) {
          this.loadZeroDueDepartments();
        } else {
          this.loadAllDepartments();
        }
      }
    });
  }

  ngOnInit(): void {
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

  // ── Card click handler ────────────────────────────────────────────────────
  selectDepartment(dept: Department): void {
    this.showAllSubDepts = false;  // close All Sub-Depts panel
    this.selectedDept = dept;
    this.subDeptSearchTerm = '';
    this.subDeptError = null;
    this.loadSubDepts(dept.departmentId);
  }

  clearDeptSelection(): void {
    this.selectedDept = null;
    this.subDepts = [];
    this.filteredSubDepts = [];
    this.subDeptSearchTerm = '';
  }

  loadSubDepts(deptId: number): void {
    this.subDeptLoading = true;
    this.subDepts = [];
    this.filteredSubDepts = [];

    this.apiService.getSubDepartmentsByDepartment(deptId).pipe(
      catchError(err => {
        this.subDeptError = err?.message || 'Failed to load sub-departments.';
        return of([]);
      })
    ).subscribe((res: SubDepartmentResponse[]) => {
      this.subDepts = res || [];
      this.applySubDeptFilters();
      this.subDeptLoading = false;
    });
  }

  applySubDeptFilters(): void {
    this.filteredSubDepts = this.subDepts.filter(sd =>
      !this.subDeptSearchTerm ||
      sd.name?.toLowerCase().includes(this.subDeptSearchTerm.toLowerCase()) ||
      sd.code?.toLowerCase().includes(this.subDeptSearchTerm.toLowerCase())
    );
    this.subDeptTotalPages  = Math.ceil(this.filteredSubDepts.length / this.subDeptPageSize) || 1;
    this.subDeptCurrentPage = 1;
  }

  resetSubDeptFilters(): void {
    this.subDeptSearchTerm = '';
    this.applySubDeptFilters();
  }

  changeSubDeptPage(page: number): void {
    if (page >= 1 && page <= this.subDeptTotalPages) this.subDeptCurrentPage = page;
  }

  getSubDeptPageNumbers(): number[] {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(this.subDeptCurrentPage - half, 1);
    let end = Math.min(start + maxVisible - 1, this.subDeptTotalPages);
    if (end - start + 1 < maxVisible) start = Math.max(end - maxVisible + 1, 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get paginatedSubDepts(): SubDepartmentResponse[] {
    const start = (this.subDeptCurrentPage - 1) * this.subDeptPageSize;
    return this.filteredSubDepts.slice(start, start + this.subDeptPageSize);
  }

  // ── All Sub-Departments handlers ──────────────────────────────────────────
  openAllSubDepts(): void {
    this.showAllSubDepts = true;
    this.selectedDept = null;        // close per-dept panel
    this.subDepts = [];
    this.filteredSubDepts = [];
    this.allSubDeptsSearchTerm = '';
    this.allSubDeptsError = null;
    if (this.allSubDepts.length === 0) {
      this.loadAllSubDepts();
    } else {
      this.applyAllSubDeptsFilters();
    }
  }

  closeAllSubDepts(): void {
    this.showAllSubDepts = false;
  }

  loadAllSubDepts(): void {
    this.allSubDeptsLoading = true;
    this.apiService.getAllSubDepartments().pipe(
      catchError(err => {
        this.allSubDeptsError = err?.message || 'Failed to load sub-departments.';
        return of([]);
      })
    ).subscribe((res: SubDepartmentResponse[]) => {
      this.allSubDepts = res || [];
      this.applyAllSubDeptsFilters();
      this.allSubDeptsLoading = false;
    });
  }

  applyAllSubDeptsFilters(): void {
    const term = this.allSubDeptsSearchTerm.toLowerCase();
    this.filteredAllSubDepts = this.allSubDepts.filter(sd =>
      !term ||
      sd.name?.toLowerCase().includes(term) ||
      sd.code?.toLowerCase().includes(term) ||
      sd.department?.name?.toLowerCase().includes(term)
    );
    this.allSubDeptsTotalPages  = Math.ceil(this.filteredAllSubDepts.length / this.allSubDeptsPageSize) || 1;
    this.allSubDeptsCurrentPage = 1;
  }

  resetAllSubDeptsFilters(): void {
    this.allSubDeptsSearchTerm = '';
    this.applyAllSubDeptsFilters();
  }

  changeAllSubDeptsPage(page: number): void {
    if (page >= 1 && page <= this.allSubDeptsTotalPages) this.allSubDeptsCurrentPage = page;
  }

  getAllSubDeptsPageNumbers(): number[] {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(this.allSubDeptsCurrentPage - half, 1);
    let end = Math.min(start + maxVisible - 1, this.allSubDeptsTotalPages);
    if (end - start + 1 < maxVisible) start = Math.max(end - maxVisible + 1, 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get paginatedAllSubDepts(): SubDepartmentResponse[] {
    const start = (this.allSubDeptsCurrentPage - 1) * this.allSubDeptsPageSize;
    return this.filteredAllSubDepts.slice(start, start + this.allSubDeptsPageSize);
  }

  // ── Edit Sub-Department Modal handlers ───────────────────────────────────
  openEditSubDeptModal(sd: SubDepartmentResponse): void {
    this.editSubDeptId = sd.id;
    this.editForm = {
      name: sd.name,
      code: sd.code,
      description: sd.description,
      departmentId: sd.department?.departmentId ?? null
    };
    this.editSubDeptError = null;
    this.editSubDeptSuccess = null;
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editSubDeptId = null;
    this.editSubDeptError = null;
    this.editSubDeptSuccess = null;
  }

  saveEditSubDept(): void {
    if (!this.editSubDeptId) return;
    if (!this.editForm.name?.trim()) {
      this.editSubDeptError = 'Name is required.';
      return;
    }
    if (!this.editForm.code?.trim()) {
      this.editSubDeptError = 'Code is required.';
      return;
    }
    if (!this.editForm.departmentId) {
      this.editSubDeptError = 'Please select a department.';
      return;
    }

    this.editSubDeptSaving = true;
    this.editSubDeptError = null;

    const payload = {
      name: this.editForm.name.trim(),
      code: this.editForm.code.trim(),
      description: this.editForm.description?.trim() || '',
      departmentId: this.editForm.departmentId
    };

    this.apiService.updateSubDepartment(this.editSubDeptId, payload).subscribe({
      next: (updated: any) => {
        this.editSubDeptSaving = false;
        this.editSubDeptSuccess = 'Sub-department updated successfully!';

        // Update in-memory lists so UI reflects change immediately
        const patch = (list: SubDepartmentResponse[]) => list.map(sd =>
          sd.id === this.editSubDeptId ? { ...sd, ...payload } : sd
        );
        this.subDepts         = patch(this.subDepts);
        this.filteredSubDepts = patch(this.filteredSubDepts);
        this.allSubDepts         = patch(this.allSubDepts);
        this.filteredAllSubDepts = patch(this.filteredAllSubDepts);

        setTimeout(() => this.closeEditModal(), 1200);
      },
      error: (err: any) => {
        this.editSubDeptSaving = false;
        this.editSubDeptError = err?.message || 'Failed to update sub-department.';
      }
    });
  }

  // ── Dept loaders ──────────────────────────────────────────────────────────
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
        error: err => {
          this.handleError(err, 'Failed to load departments with zero due tasks.');
        }
      })
    );
  }

  private handleDepartmentResponseforZero(depts: any): void {
    let safeList: Department[] = [];
    if (Array.isArray(depts))                   safeList = depts;
    else if (depts && Array.isArray(depts.data)) safeList = depts.data;
    this.departments = safeList;
    this.applyFilters();
    this.loading = false;
    this.autoSelectDefaultDepartment();
  }

  openAddDepartment(): void {
    this.router.navigate(['/add-department']);
  }

  openAddSubDepartment(): void {
    this.addSubDeptForm = { name: '', code: '', description: '', departmentId: this.selectedDept?.departmentId ?? null };
    this.addSubDeptError = null;
    this.addSubDeptSuccess = null;
    this.showAddSubDeptModal = true;
  }

  closeAddSubDeptModal(): void {
    this.showAddSubDeptModal = false;
    this.addSubDeptError = null;
    this.addSubDeptSuccess = null;
  }

  saveAddSubDept(): void {
    if (!this.addSubDeptForm.name?.trim()) {
      this.addSubDeptError = 'Name is required.';
      return;
    }
    if (!this.addSubDeptForm.code?.trim()) {
      this.addSubDeptError = 'Code is required.';
      return;
    }
    if (!this.addSubDeptForm.departmentId) {
      this.addSubDeptError = 'Please select a parent department.';
      return;
    }

    this.addSubDeptSaving = true;
    this.addSubDeptError = null;

    const payload = {
      name: this.addSubDeptForm.name.trim(),
      code: this.addSubDeptForm.code.trim(),
      description: this.addSubDeptForm.description?.trim() || '',
      departmentId: this.addSubDeptForm.departmentId
    };

    this.apiService.createSubDepartment(payload).subscribe({
      next: (created: any) => {
        this.addSubDeptSaving = false;
        this.addSubDeptSuccess = 'Sub-department created successfully!';

        // Refresh lists so the new entry appears immediately
        this.allSubDepts = [];
        if (this.showAllSubDepts) {
          this.loadAllSubDepts();
        }
        if (this.selectedDept?.departmentId === this.addSubDeptForm.departmentId) {
          this.loadSubDepts(this.addSubDeptForm.departmentId!);
        }

        setTimeout(() => this.closeAddSubDeptModal(), 1200);
      },
      error: (err: any) => {
        this.addSubDeptSaving = false;
        this.addSubDeptError = err?.message || 'Failed to create sub-department.';
      }
    });
  }

  goBackToDashboard() {
    const token = this.jwtService.getAccessToken();
    if (token) {
      this.jwtService.decodeToken(token);
      this.authApiService.goToDashboard();
    } else {
      this.router.navigate(['/login']);
    }
  }

  private loadAllDepartments(): void {
    this.loading = true;

    this.apiService.getAuthorizedDepartments().subscribe({
      next: (res: Department[]) => {
        const activeDepartments = (res || []).filter(
          dept => dept.departmentStatus === 'ACTIVE' || !dept.departmentStatus
        );
        this.handleDepartmentResponse(activeDepartments);
      },
      error: err => this.handleError(err, 'Failed to load departments.')
    });
  }

  private handleDepartmentResponse(depts: Department[]): void {
    this.departments = depts || [];
    this.applyFilters();
    this.loading = false;
    this.autoSelectDefaultDepartment();
  }

  /**
   * Auto-selects the default department card when the page loads.
   * Preference order:
   * 1. Keep the currently selected department if it still exists in the response.
   * 2. Prefer a department whose name includes "Admission".
   * 3. Fallback to the first department returned by the API.
   */
  private autoSelectDefaultDepartment(): void {
    if (!this.departments || this.departments.length === 0) {
      return;
    }

    const currentSelectionStillExists = this.selectedDept?.departmentId
      && this.departments.some(dept => dept.departmentId === this.selectedDept?.departmentId);

    if (currentSelectionStillExists) {
      return;
    }

    const defaultDept = this.departments.find(dept =>
      dept.name?.trim().toLowerCase().includes('admission')
    ) || this.departments[0];

    this.selectDepartment(defaultDept);
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
    this.totalPages  = Math.ceil(this.filteredDepartments.length / this.pageSize) || 1;
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
    if (departmentId) this.router.navigate(['/department', departmentId]);
  }

  editDepartment(event: Event, departmentId?: number): void {
    event.stopPropagation();
    if (departmentId) this.router.navigate(['/edit-department', departmentId]);
  }

  deleteDepartment(event: Event, departmentId?: number): void {
    event.stopPropagation();
    if (!departmentId) return;

    this.confirmDialogService.confirm('Are you sure you want to delete this department?').then((confirmed) => {
      if (confirmed) {
        this.apiService.deleteDepartment(departmentId).subscribe({
          next: () => {
            this.departments = this.departments.filter(d => d.departmentId !== departmentId);
            if (this.selectedDept?.departmentId === departmentId) this.clearDeptSelection();
            this.applyFilters();
          },
          error: err => this.handleError(err, 'Failed to delete department.')
        });
      }
    });
  }
}
