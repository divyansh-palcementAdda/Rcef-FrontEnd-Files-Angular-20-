import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  TaskTemplateApiService, 
  TaskTemplateDetailsDto,
  TaskTemplateDetailsCategoryDto,
  TaskTemplateDetailsFieldDto,
  TaskTemplateDetailsProofRequirementDto,
  TemplateAnalytics,
  TemplateUser,
  TemplateDepartment,
  UserBreakdownDto,
  DepartmentBreakdownDto,
  StatusBreakdown
} from '../../../Services/task-template-api.service';

@Component({
  selector: 'app-view-template-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-task-template.html',
  styleUrls: ['./view-task-template.css']
})
export class ViewTemplateTaskComponent implements OnInit {
  templateId: number | null = null;
  isLoading: boolean = false;
  errorMessage: string | null = null;
  activeBreakdownTab: 'users' | 'departments' = 'users';

  template: TaskTemplateDetailsDto = {
    templateId: 0,
    title: '',
    description: '',
    category: {
      name: '',
      subcategory: null
    },
    fields: [],
    proofRequirements: [],
    active: false,
    userBreakdown: [],
    departmentBreakdown: [],
    users: [],
    departments: []
  };

  // --- Pagination for Users Tab ---
  usersCurrentPage: number = 1;
  usersPageSize: number = 5;

  get usersTotalPages(): number {
    return Math.ceil((this.template.users?.length || 0) / this.usersPageSize);
  }

  get paginatedUsers(): TemplateUser[] {
    const start = (this.usersCurrentPage - 1) * this.usersPageSize;
    return (this.template.users || []).slice(start, start + this.usersPageSize);
  }

  getUsersPageNumbers(): number[] {
    const total = this.usersTotalPages;
    const current = this.usersCurrentPage;
    const pages: number[] = [];
    const range = 2;
    for (let i = Math.max(1, current - range); i <= Math.min(total, current + range); i++) {
      pages.push(i);
    }
    return pages;
  }

  changeUsersPage(page: number): void {
    if (page < 1 || page > this.usersTotalPages) return;
    this.usersCurrentPage = page;
  }

  // --- Pagination for Departments Tab ---
  deptsCurrentPage: number = 1;
  deptsPageSize: number = 5;

  get deptsTotalPages(): number {
    return Math.ceil((this.template.departments?.length || 0) / this.deptsPageSize);
  }

  get paginatedDepts(): TemplateDepartment[] {
    const start = (this.deptsCurrentPage - 1) * this.deptsPageSize;
    return (this.template.departments || []).slice(start, start + this.deptsPageSize);
  }

  getDeptsPageNumbers(): number[] {
    const total = this.deptsTotalPages;
    const current = this.deptsCurrentPage;
    const pages: number[] = [];
    const range = 2;
    for (let i = Math.max(1, current - range); i <= Math.min(total, current + range); i++) {
      pages.push(i);
    }
    return pages;
  }

  changeDeptsPage(page: number): void {
    if (page < 1 || page > this.deptsTotalPages) return;
    this.deptsCurrentPage = page;
  }

  // Math reference for template use
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private templateService: TaskTemplateApiService
  ) { }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.templateId = Number(idParam);
      this.loadTemplateDetails(this.templateId);
    } else {
      this.errorMessage = 'No template ID was provided in the URL route.';
    }
  }

  loadTemplateDetails(id: number): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.templateService.getTemplateDetails(id).subscribe({
      next: (res) => {
        if (res && res.templateId !== undefined) {
          this.template = res;
        } else {
          this.errorMessage = 'Failed to load task template details.';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'An error occurred while loading the task template details.';
        this.isLoading = false;
      }
    });
  }

  setBreakdownTab(tab: 'users' | 'departments'): void {
    this.activeBreakdownTab = tab;
    // Reset pagination on tab switch
    this.usersCurrentPage = 1;
    this.deptsCurrentPage = 1;
  }

  goBack(): void {
    this.router.navigate(['/task-templates']);
  }
}