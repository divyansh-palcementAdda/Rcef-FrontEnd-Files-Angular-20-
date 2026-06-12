import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskTemplateApiService, TaskTemplateDto, TaskTemplateCategoryDto, TaskTemplateFieldDto, TaskTemplateProofRequirementDto } from '../../../Services/task-template-api.service';

@Component({
  selector: 'app-task-template-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './task-template-management.html',
  styleUrls: ['./task-template-management.css']
})
export class TaskTemplateManagementComponent implements OnInit {
  activeTab: 'templates' | 'categories' | 'fields' | 'requirements' = 'templates';

  // Lists
  templates: TaskTemplateDto[] = [];
  categories: TaskTemplateCategoryDto[] = [];
  selectedTemplate: TaskTemplateDto | null = null;

  // Forms
  templateForm!: FormGroup;
  categoryForm!: FormGroup;
  fieldForm!: FormGroup;
  requirementForm!: FormGroup;

  // Edit states
  isEditingTemplate = false;
  editingTemplateId: number | null = null;
  isEditingCategory = false;
  editingCategoryId: number | null = null;

  // UI status
  successMessage: string | null = null;
  errorMessage: string | null = null;

  // Modal visibility
  showTemplateModal = false;
  showCategoryModal = false;

  // Options
  fieldTypes = ['TEXT', 'NUMBER', 'PERCENTAGE', 'DATE', 'DROPDOWN', 'MULTISELECT', 'LIST', 'FILE_UPLOAD', 'EXCEL_UPLOAD', 'CSV_UPLOAD', 'BOOLEAN'];
  proofTypes = ['STUDENT_ENTRIES', 'ATTENDANCE_UPLOAD', 'TOPICS_LIST', 'FILE_UPLOAD'];

  constructor(
    private fb: FormBuilder,
    private templateService: TaskTemplateApiService,
    private router: Router
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadData();
  }

  private initForms(): void {
    this.templateForm = this.fb.group({
      categoryId: ['', Validators.required],
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', Validators.maxLength(2000)],
      isActive: [true]
    });

    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      subcategory: [''],
      isActive: [true]
    });

    this.fieldForm = this.fb.group({
      fieldName: ['', Validators.required],
      fieldType: ['TEXT', Validators.required],
      isRequired: [false],
      options: ['']
    });

    this.requirementForm = this.fb.group({
      proofType: ['FILE_UPLOAD', Validators.required],
      isRequired: [true]
    });
  }

  loadData(): void {
    this.templateService.getAllTemplates().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.templates = res.data;
          if (this.selectedTemplate) {
            const updated = res.data.find(t => t.id === this.selectedTemplate?.id);
            if (updated) this.selectedTemplate = updated;
          }
        }
      },
      error: (err) => (this.errorMessage = 'Failed to load templates')
    });

    this.templateService.getAllCategories().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.categories = res.data;
        }
      },
      error: (err) => (this.errorMessage = 'Failed to load categories')
    });
  }

  selectTemplate(tpl: TaskTemplateDto): void {
    this.selectedTemplate = tpl;
  }

  // CATEGORY OPERATIONS
  openCreateCategoryModal(): void {
    this.resetCategoryForm();
    this.showCategoryModal = true;
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) return;

    this.successMessage = null;
    this.errorMessage = null;
    const val = this.categoryForm.value;
    const obs = this.isEditingCategory && this.editingCategoryId
      ? this.templateService.updateCategory(this.editingCategoryId, val)
      : this.templateService.createCategory(val);

    obs.subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.resetCategoryForm();
        this.loadData();
      },
      error: (err) => (this.errorMessage = err.error?.message || 'Failed to save category')
    });
  }

  editCategory(cat: TaskTemplateCategoryDto): void {
    this.isEditingCategory = true;
    this.editingCategoryId = cat.id || null;
    this.categoryForm.patchValue({
      name: cat.name,
      subcategory: cat.subcategory,
      isActive: cat.isActive
    });
    this.showCategoryModal = true;
  }

  resetCategoryForm(): void {
    this.isEditingCategory = false;
    this.editingCategoryId = null;
    this.showCategoryModal = false;
    this.categoryForm.reset({ name: '', subcategory: '', isActive: true });
  }

  // TEMPLATE OPERATIONS
  saveTemplate(): void {
    if (this.templateForm.invalid) return;

    this.successMessage = null;
    this.errorMessage = null;
    const val = this.templateForm.value;
    const cat = this.categories.find(c => c.id === +val.categoryId);
    if (!cat) return;

    const payload: TaskTemplateDto = {
      title: val.title,
      description: val.description,
      isActive: val.isActive,
      category: cat
    };

    const obs = this.isEditingTemplate && this.editingTemplateId
      ? this.templateService.updateTemplate(this.editingTemplateId, { ...payload, fields: this.selectedTemplate?.fields, proofRequirements: this.selectedTemplate?.proofRequirements })
      : this.templateService.createTemplate(payload);

    obs.subscribe({
      next: (res) => {
        this.successMessage = res.message;
        this.resetTemplateForm();
        this.loadData();
      },
      error: (err) => (this.errorMessage = err.error?.message || 'Failed to save template')
    });
  }

  openCreateTemplateModal(): void {
    this.resetTemplateForm();
    this.showTemplateModal = true;
  }

  editTemplate(tpl: TaskTemplateDto): void {
    this.isEditingTemplate = true;
    this.editingTemplateId = tpl.id || null;
    this.selectedTemplate = tpl;
    this.templateForm.patchValue({
      categoryId: tpl.category.id,
      title: tpl.title,
      description: tpl.description,
      isActive: tpl.isActive
    });
    this.showTemplateModal = true;
  }

  deleteTemplate(id: number): void {
    if (confirm('Are you sure you want to deactivate this template?')) {
      this.templateService.deleteTemplate(id).subscribe({
        next: (res) => {
          this.successMessage = 'Template deactivated successfully';
          this.loadData();
        }
      });
    }
  }

  resetTemplateForm(): void {
    this.isEditingTemplate = false;
    this.editingTemplateId = null;
    this.showTemplateModal = false;
    this.templateForm.reset({ categoryId: '', title: '', description: '', isActive: true });
  }

  // FIELD OPERATIONS
  addField(): void {
    if (this.fieldForm.invalid || !this.selectedTemplate) return;

    this.successMessage = null;
    this.errorMessage = null;
    const fVal: TaskTemplateFieldDto = this.fieldForm.value;
    const tpl = this.selectedTemplate;
    const fields = tpl.fields ? [...tpl.fields, fVal] : [fVal];

    this.templateService.updateTemplate(tpl.id!, {
      ...tpl,
      fields
    }).subscribe({
      next: (res) => {
        this.successMessage = 'Field added successfully';
        this.fieldForm.reset({ fieldName: '', fieldType: 'TEXT', isRequired: false, options: '' });
        this.selectedTemplate = res.data || null;
        this.loadData();
      },
      error: (err) => (this.errorMessage = 'Failed to add field')
    });
  }

  removeField(idx: number): void {
    if (!this.selectedTemplate || !this.selectedTemplate.fields) return;

    this.successMessage = null;
    this.errorMessage = null;
    const tpl = this.selectedTemplate;
    const fields = [...(tpl.fields || [])];
    fields.splice(idx, 1);

    this.templateService.updateTemplate(tpl.id!, {
      ...tpl,
      fields
    }).subscribe({
      next: (res) => {
        this.successMessage = 'Field removed successfully';
        this.selectedTemplate = res.data || null;
        this.loadData();
      },
      error: (err) => (this.errorMessage = 'Failed to remove field')
    });
  }

  // REQUIREMENT OPERATIONS
  addRequirement(): void {
    if (this.requirementForm.invalid || !this.selectedTemplate) return;

    this.successMessage = null;
    this.errorMessage = null;
    const rVal: TaskTemplateProofRequirementDto = this.requirementForm.value;
    const tpl = this.selectedTemplate;
    const proofRequirements = tpl.proofRequirements ? [...tpl.proofRequirements, rVal] : [rVal];

    this.templateService.updateTemplate(tpl.id!, {
      ...tpl,
      proofRequirements
    }).subscribe({
      next: (res) => {
        this.successMessage = 'Proof requirement added successfully';
        this.requirementForm.reset({ proofType: 'FILE_UPLOAD', isRequired: true });
        this.selectedTemplate = res.data || null;
        this.loadData();
      },
      error: (err) => (this.errorMessage = 'Failed to add requirement')
    });
  }

  removeRequirement(idx: number): void {
    if (!this.selectedTemplate || !this.selectedTemplate.proofRequirements) return;

    this.successMessage = null;
    this.errorMessage = null;
    const tpl = this.selectedTemplate;
    const proofRequirements = [...(tpl.proofRequirements || [])];
    proofRequirements.splice(idx, 1);

    this.templateService.updateTemplate(tpl.id!, {
      ...tpl,
      proofRequirements
    }).subscribe({
      next: (res) => {
        this.successMessage = 'Proof requirement removed successfully';
        this.selectedTemplate = res.data || null;
        this.loadData();
      },
      error: (err) => (this.errorMessage = 'Failed to remove requirement')
    });
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }
}
