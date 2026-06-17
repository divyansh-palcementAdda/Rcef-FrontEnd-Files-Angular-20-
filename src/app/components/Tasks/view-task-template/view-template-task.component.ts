import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
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
  imports: [CommonModule],
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
  }

  goBack(): void {
    this.router.navigate(['/task-templates']);
  }
}