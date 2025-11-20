import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
export class AddDepartmentComponent {
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
          Validators.pattern(/^[a-zA-Z0-9\s\-']+$/)
        ]
      ],
      description: ['', [Validators.maxLength(500)]]
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

    this.apiService.createDepartment(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = '✅ Department created successfully!';
        this.departmentForm.reset();
        this.authApiService.goToDashboard();

      },
      error: (err) => {
        console.error('Error creating department:', err);
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to create department. Please try again.';
      }
    });
  }

  cancel(): void {
    this.authApiService.goToDashboard();
  }
}
