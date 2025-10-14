import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { Department } from '../../../Model/department';
import { TaskStatus } from '../../../Model/TaskStatus';
import { userDto } from '../../../Model/userDto';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';

@Component({
  selector: 'app-add-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-task.html',
  styleUrls: ['./add-task.css']
})
export class AddTaskComponent implements OnInit {
  taskForm!: FormGroup;
  departments: Department[] = [];
  users: userDto[] = [];
  filteredUsers: userDto[] = [];
  statuses: string[] = Object.values(TaskStatus);

  successMessage: string | null = null;
  errorMessage: string | null = null;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private taskApiService: TaskApiService,
    private userApiService: UserApiService
  ) {}

  ngOnInit(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      dueDate: ['', Validators.required],
      startDate: [''],
      status: ['', Validators.required],
      createdById: [null],
      assignedToIds: [[]],
      assignToSelf: [false],
      departmentId: [null, Validators.required]
    });

    this.loadDepartments();

    // React when department changes
    this.taskForm.get('departmentId')?.valueChanges.subscribe((deptId) => {
      console.log('Selected departmentId:', deptId);
      if (typeof deptId === 'number' && deptId > 0) {
        console.log('Loading users for department ID:', deptId);
        this.loadUsers(deptId);
      } else {
        console.warn('Invalid department ID selected:', deptId);
        this.filteredUsers = [];
        this.taskForm.patchValue({ assignedToIds: [] });
      }
    });

    // Add validation dynamically for upcoming tasks
    this.taskForm.get('status')?.valueChanges.subscribe((status) => {
      const startDateControl = this.taskForm.get('startDate');
      if (status === TaskStatus.UPCOMING) {
        startDateControl?.setValidators([Validators.required]);
      } else {
        startDateControl?.clearValidators();
      }
      startDateControl?.updateValueAndValidity();
    });
  }

  get f() {
    return this.taskForm.controls;
  }

  loadDepartments(): void {
    this.apiService.getAllDepartments().subscribe({
      next: (data: Department[]) => {
        console.log(`Loaded ${data.length} departments`);
        this.departments = data.filter(
          (d) => d.name?.trim().toLowerCase() !== 'administration'
        );
      },
      error: (err) => {
        console.error('Failed to load departments', err);
        this.errorMessage = 'Failed to load departments. Please try again.';
      }
    });
  }

  loadUsers(departmentId: number): void {
    this.userApiService.getAllUsersByDepartment(departmentId).subscribe({
      next: (data: userDto[]) => {
        this.users = data;
        this.filteredUsers = data;
        console.log(`Loaded ${data.length} users for department ID ${departmentId}`);
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.errorMessage = 'Failed to load users for the selected department.';
        this.filteredUsers = [];
        this.taskForm.patchValue({ assignedToIds: [] });
      }
    });
  }

  assignToSelfChange(): void {
    if (this.taskForm.value.assignToSelf) {
      const createdById = Number(this.taskForm.value.createdById);
      if (createdById && !isNaN(createdById)) {
        this.taskForm.patchValue({ assignedToIds: [createdById] });
        this.successMessage = '✅ Task automatically assigned to you.';
      } else {
        this.errorMessage = 'Cannot assign to self: Creator ID is not set.';
        this.taskForm.patchValue({ assignToSelf: false });
      }
    } else {
      this.taskForm.patchValue({ assignedToIds: [] });
    }
  }

  onSubmit(): void {
    this.successMessage = null;
    this.errorMessage = null;

    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.errorMessage = 'Please correct the errors in the form.';
      return;
    }

    this.isSubmitting = true;

    const payload = {
      ...this.taskForm.value,
      title: `Task: ${this.taskForm.value.title}`,
      description: `Details: ${this.taskForm.value.description}`,
      departmentId: Number(this.taskForm.value.departmentId)
    };

    this.taskApiService.createTask(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = '✅ Task added successfully!';
        this.taskForm.reset();
        this.filteredUsers = [];
        setTimeout(() => this.router.navigate(['/view-tasks']), 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to add task.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/view-tasks']);
  }
}
