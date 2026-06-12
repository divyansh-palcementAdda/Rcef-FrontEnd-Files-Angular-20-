import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { Department } from '../../../Model/department';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuthApiService } from '../../../Services/auth-api-service';

@Component({
  selector: 'app-add-department',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-department.html',
  styleUrls: ['./add-department.css'],
})
export class AddDepartmentComponent implements OnInit, OnChanges {
  @Input() isModal = false;
  @Input() departmentId?: number;
  @Output() closed = new EventEmitter<boolean>();

  departmentForm: FormGroup;
  isSubmitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private apiService: DepartmentApiService,
    private router: Router,
    private authApiService: AuthApiService
  ) {
    this.departmentForm = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(100),
          // Validators.pattern(/^[a-zA-Z0-9\s\-']+$/)
        ]
      ],
      description: ['', [Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    if (this.departmentId) {
      this.loadDepartment();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['departmentId'] && !changes['departmentId'].firstChange) {
      this.loadDepartment();
    }
  }

  loadDepartment(): void {
    if (!this.departmentId) return;
    this.apiService.getDepartmentById(this.departmentId).subscribe({
      next: (dept) => {
        this.departmentForm.patchValue({
          name: dept.name,
          description: dept.description || ''
        });
      },
      error: (err) => {
        console.error('Error loading department details:', err);
        this.errorMessage = err?.message || 'Failed to load department details.';
      }
    });
  }

  onSubmit(): void {
    if (this.departmentForm.invalid) {
      this.departmentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = null;
    this.errorMessage = null;

    const payload: Department = {
      ...this.departmentForm.value
    };

    console.log('Department Payload:', payload);

    if (this.departmentId) {
      this.apiService.updateDepartment(this.departmentId, payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = '✅ Department updated successfully!';
          setTimeout(() => {
            if (this.isModal) {
              this.closed.emit(true);
            } else {
              this.authApiService.goToDashboard();
            }
          }, 1500);
        },
        error: (err) => {
          console.error('Error updating department:', err);
          this.isSubmitting = false;
          this.errorMessage = err?.message || 'Failed to update department. Please try again.';
        }
      });
    } else {
      this.apiService.createDepartment(payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.successMessage = '✅ Department created successfully!';
          this.departmentForm.reset();
          setTimeout(() => {
            if (this.isModal) {
              this.closed.emit(true);
            } else {
              this.authApiService.goToDashboard();
            }
          }, 1500);
        },
        error: (err) => {
          console.error('Error creating department:', err);
          this.isSubmitting = false;
          this.errorMessage = err?.message || 'Failed to create department. Please try again.';
        }
      });
    }
  }

  cancel(): void {
    if (this.isModal) {
      this.closed.emit(false);
    } else {
      this.authApiService.goToDashboard();
    }
  }
}
