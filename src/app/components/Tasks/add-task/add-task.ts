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

  constructor(private fb: FormBuilder, private apiService: ApiService, private router: Router,private taskApiservice : TaskApiService,
    private userApiService : UserApiService
  ) {}

  ngOnInit(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      dueDate: ['', Validators.required],
      startDate: [''],
      status: ['', Validators.required],
      createdById: [''],
      assignedToIds: [[]],
      assignToSelf: [false],
      departmentId: ['', Validators.required]
    });

    this.loadDepartments();

    // Fetch users when departmentId changes
    this.taskForm.get('departmentId')?.valueChanges.subscribe(deptId => {
      if (deptId && !isNaN(Number(deptId))) {
        console.log('Department changed, loading users for department ID:', deptId);
        this.loadUsers(Number(deptId));
      } else {
        console.warn('Invalid department ID selected:', deptId);
        this.filteredUsers = [];
        this.taskForm.patchValue({ assignedToIds: [] }); // Clear assigned users if no valid department
      }
    });

    // Validate start date for UPCOMING tasks
    this.taskForm.get('status')?.valueChanges.subscribe(status => {
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
        console.table(data);
        this.departments = data.filter(d => d.name.toUpperCase() !== 'ADMINSTRATION'); // Fixed typo
      },
      error: err => {
        console.error('Failed to load departments', err);
        this.errorMessage = 'Failed to load departments. Please try again.';
      }
    });
  }

  loadUsers(departmentId: number): void {
    console.log('Loading users for department ID:', departmentId);
    this.userApiService.getAllUsersByDepartment(departmentId).subscribe({
      next: (data: userDto[]) => {
        this.users = data;
        this.filteredUsers = data;
        console.log(`Loaded ${data.length} users for department ID ${departmentId}`);
      },
      error: err => {
        console.error('Failed to load users', err);
        this.errorMessage = 'Failed to load users for the selected department.';
        this.filteredUsers = [];
        this.taskForm.patchValue({ assignedToIds: [] });
      }
    });
  }

  assignToSelfChange(): void {
    if (this.taskForm.value.assignToSelf) {
      const createdById = this.taskForm.value.createdById;
      if (createdById) {
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
      departmentId: Number(this.taskForm.value.departmentId) // Ensure departmentId is a number
    };

    this.taskApiservice.createTask(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = '✅ Task added successfully!';
        this.taskForm.reset();
        this.filteredUsers = [];
        setTimeout(() => this.router.navigate(['/view-tasks']), 1500); // Redirect after success
      },
      error: err => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to add task.';
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/view-tasks']);
  }
}