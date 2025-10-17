import { CommonModule } from '@angular/common';
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Department } from '../../../Model/department';
import { TaskStatus } from '../../../Model/TaskStatus';
import { userDto } from '../../../Model/userDto';
import { TaskApiService } from '../../../Services/task-api-Service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { Collapse } from 'bootstrap';
 // Import Bootstrap Collapse for manual initialization

@Component({
  selector: 'app-add-task',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './add-task.html',
  styleUrls: ['./add-task.css']
})
export class AddTaskComponent implements OnInit, AfterViewInit {
  taskForm!: FormGroup;
  departments: Department[] = [];
  departmentMap: Map<number, string> = new Map();
  users: userDto[] = [];
  usersByDepartment: Map<number, userDto[]> = new Map();
  selectedUsersByDeptObj: { [deptId: number]: number[] } = {};
  statuses: string[] = Object.values(TaskStatus);
  successMessage: string | null = null;
  errorMessage: string | null = null;
  isSubmitting = false;
  isLoadingDepartments = false;
  isLoadingUsers = false;
  loggedInUserID: number | null = null;
  currentUser!: userDto;

  constructor(
    private fb: FormBuilder,
    private departmentService: DepartmentApiService,
    private userService: UserApiService,
    private taskService: TaskApiService,
    private router: Router,
    private jwtService: JwtService
  ) {}

  ngOnInit(): void {
    // Initialize form with validators
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      status: ['', Validators.required],
      startDate: [''],
      dueDate: ['', Validators.required],
      departmentIds: [[], Validators.required],
      assignToSelf: [false],
      assignedToIds: [[]]
    });

    // Extract logged-in user ID from token
    const token = localStorage.getItem('token');
    if (token) {
      this.loggedInUserID = this.jwtService.getUserIdFromToken(token);
    } else {
      this.errorMessage = 'No authentication found. Please log in.';
      console.error('No token found');
      return;
    }

    // Load current user details
    if (this.loggedInUserID) {
      this.userService.getUserById(this.loggedInUserID).subscribe({
        next: (user: userDto) => {
          this.currentUser = user;
          this.loadDepartments();
        },
        error: (err) => {
          this.errorMessage = 'Failed to load current user: ' + (err?.error?.message || 'Unknown error');
          console.error('User load error:', err);
        }
      });
    }

    // Subscribe to departmentIds changes to load users dynamically
    this.taskForm.get('departmentIds')?.valueChanges.subscribe((deptIds: number[]) => {
      this.loadUsersForDepartments(deptIds);
    });

    // Dynamic validator for startDate based on status
    this.taskForm.get('status')?.valueChanges.subscribe((status) => {
      const startDateControl = this.taskForm.get('startDate');
      if (status === TaskStatus.UPCOMING) {
        startDateControl?.setValidators([Validators.required]);
      } else {
        startDateControl?.clearValidators();
      }
      startDateControl?.updateValueAndValidity();
    });

    // Handle "Assign to self" checkbox changes
    this.taskForm.get('assignToSelf')?.valueChanges.subscribe(() => {
      this.assignToSelfChange();
    });
  }

  ngAfterViewInit(): void {
    // Initialize Bootstrap Collapse manually to ensure accordion works
    const accordionItems = document.querySelectorAll('.accordion-collapse');
    accordionItems.forEach((item, index) => {
      const collapse = new Collapse(item, {
        toggle: index === 0 // Open the first accordion item by default
      });
    });
  }

  get f() {
    return this.taskForm.controls;
  }

  /** Load departments based on user role */
  private loadDepartments(): void {
    this.isLoadingDepartments = true;
    this.departmentService.getAllDepartments().subscribe({
      next: (departments: Department[]) => {
        if (this.currentUser.role === 'HOD') {
          this.departments = departments.filter(d => d.departmentId === this.currentUser.departmentId);
          this.taskForm.patchValue({ departmentIds: [this.currentUser.departmentId] });
        } else if (this.currentUser.role === 'ADMIN') {
          this.departments = departments;
        } else {
          this.departments = departments.filter(d => d.name?.toLowerCase() !== 'administration');
        }
        this.departmentMap = new Map(this.departments.map(d => [d.departmentId, d.name || 'Unknown']));
        this.isLoadingDepartments = false;
        // Load users for initial department selection
        this.loadUsersForDepartments(this.taskForm.value.departmentIds);
      },
      error: (err) => {
        this.isLoadingDepartments = false;
        this.errorMessage = 'Failed to load departments: ' + (err?.error?.message || 'Unknown error');
        console.error('Departments load error:', err);
      }
    });
  }

  /** Load users for selected departments without clearing previous selections */
  private loadUsersForDepartments(deptIds: number[]): void {
    if (!deptIds?.length) {
      this.usersByDepartment.clear();
      this.selectedUsersByDeptObj = {};
      this.taskForm.patchValue({ assignedToIds: [] });
      this.isLoadingUsers = false;
      return;
    }

    this.isLoadingUsers = true;

    // Preserve existing user selections for departments that are still selected
    const preservedSelections = { ...this.selectedUsersByDeptObj };
    Object.keys(preservedSelections).forEach(key => {
      const deptId = Number(key);
      if (!deptIds.includes(deptId)) {
        delete this.selectedUsersByDeptObj[deptId];
        this.usersByDepartment.delete(deptId);
      }
    });

    // Fetch users only for newly added departments
    const missingDepts = deptIds.filter(deptId => !this.usersByDepartment.has(deptId));
    if (missingDepts.length > 0) {
      this.userService.getUsersByDepartments(missingDepts).subscribe({
        next: (users: userDto[]) => {
          console.log(users);
          this.users = [...this.users, ...users.filter(u => !this.users.some(existing => existing.userId === u.userId))];
          missingDepts.forEach(deptId => {
            const usersInDept = users.filter(u => u.departmentId === deptId);
            this.usersByDepartment.set(deptId, usersInDept);
            if (!this.selectedUsersByDeptObj[deptId]) {
              this.selectedUsersByDeptObj[deptId] = preservedSelections[deptId] || [];
            }
          });
          this.updateAssignedUsers();
          this.isLoadingUsers = false;
        },
        error: (err) => {
          this.isLoadingUsers = false;
          this.errorMessage = 'Failed to load users for selected departments: ' + (err?.error?.message || 'Unknown error');
          console.error('Users load error:', err);
          missingDepts.forEach(deptId => {
            this.usersByDepartment.set(deptId, []);
            this.selectedUsersByDeptObj[deptId] = preservedSelections[deptId] || [];
          });
          this.updateAssignedUsers();
        }
      });
    } else {
      // Restore selections for existing departments
      deptIds.forEach(deptId => {
        if (!this.selectedUsersByDeptObj[deptId]) {
          this.selectedUsersByDeptObj[deptId] = preservedSelections[deptId] || [];
        }
      });
      this.updateAssignedUsers();
      this.isLoadingUsers = false;
    }
  }

  /** Update department selection */
  updateDepartmentSelection(event: Event, deptId: number): void {
    const input = event.target as HTMLInputElement;
    let deptIds = [...this.taskForm.value.departmentIds];

    if (input.checked) {
      if (!deptIds.includes(deptId)) {
        deptIds.push(deptId);
      }
    } else {
      deptIds = deptIds.filter(id => id !== deptId);
      // Clear selections for deselected department
      if (this.selectedUsersByDeptObj[deptId]) {
        delete this.selectedUsersByDeptObj[deptId];
      }
    }

    this.taskForm.patchValue({ departmentIds: deptIds });
  }

  /** Update user selection */
  updateUserSelection(event: Event, deptId: number, userId: number): void {
    const input = event.target as HTMLInputElement;
    let selectedUsers = [...(this.selectedUsersByDeptObj[deptId] || [])];

    if (input.checked) {
      if (!selectedUsers.includes(userId)) {
        selectedUsers.push(userId);
      }
    } else {
      selectedUsers = selectedUsers.filter(id => id !== userId);
    }

    this.selectedUsersByDeptObj[deptId] = selectedUsers;
    this.updateAssignedUsers();
  }

  /** Update assigned users list in form */
  private updateAssignedUsers(): void {
    const allSelectedUserIds = Object.values(this.selectedUsersByDeptObj).flat();
    this.taskForm.patchValue({ assignedToIds: allSelectedUserIds });
  }

  /** Handle "assign to self" checkbox */
  assignToSelfChange(): void {
    if (this.taskForm.value.assignToSelf && this.loggedInUserID) {
      const myDeptId = this.currentUser.departmentId;
      const selectedDeptIds = this.taskForm.value.departmentIds;

      if (selectedDeptIds.includes(myDeptId)) {
        let selectedUsers = this.selectedUsersByDeptObj[myDeptId] || [];
        if (!selectedUsers.includes(this.loggedInUserID)) {
          selectedUsers = [this.loggedInUserID]; // Only assign self, clear others
        }
        this.selectedUsersByDeptObj[myDeptId] = selectedUsers;
        this.successMessage = '✅ Task automatically assigned to you in your department.';
      } else {
        this.errorMessage = 'Cannot assign to self: your department is not selected.';
        this.taskForm.patchValue({ assignToSelf: false });
      }
    } else {
      const myDeptId = this.currentUser.departmentId;
      if (this.selectedUsersByDeptObj[myDeptId]) {
        this.selectedUsersByDeptObj[myDeptId] = this.selectedUsersByDeptObj[myDeptId].filter(id => id !== this.loggedInUserID);
      }
    }
    this.updateAssignedUsers();
  }

  /** Date Validation Utility */
  private validateDates(startDateInput: string | Date, dueDateInput: string | Date): { valid: boolean; message: string } {
    const startDate = startDateInput ? new Date(startDateInput) : null;
    const dueDate = new Date(dueDateInput);

    if (!dueDate || isNaN(dueDate.getTime())) {
      return { valid: false, message: '❌ Invalid due date. Please select a valid date.' };
    }

    if (startDate && isNaN(startDate.getTime())) {
      return { valid: false, message: '❌ Invalid start date. Please select a valid date.' };
    }

    if (startDate && startDate.getDay() === 0) {
      return { valid: false, message: '❌ Start date cannot be on Sunday.' };
    }

    if (dueDate.getDay() === 0) {
      return { valid: false, message: '❌ Due date cannot be on Sunday.' };
    }

    if (startDate && dueDate.getTime() < startDate.getTime()) {
      return { valid: false, message: '❌ Due date cannot be before start date.' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate && startDate < today) {
      return { valid: false, message: '❌ Start date cannot be in the past.' };
    }

    if (dueDate < today) {
      return { valid: false, message: '❌ Due date cannot be in the past.' };
    }

    return { valid: true, message: '✅ Dates are valid.' };
  }

  /** Submit Task */
  onSubmit(): void {
    this.successMessage = null;
    this.errorMessage = null;

    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.errorMessage = 'Please fix errors before submitting.';
      return;
    }

    const { title, description, status, startDate, dueDate, departmentIds, assignedToIds } = this.taskForm.value;

    // Validate dates before sending request
    const dateValidation = this.validateDates(startDate, dueDate);
    if (!dateValidation.valid) {
      this.errorMessage = dateValidation.message;
      return;
    }

    this.isSubmitting = true;

    const payload = {
      title,
      description,
      dueDate,
      startDate: status === TaskStatus.UPCOMING ? startDate : undefined,
      status,
      departmentIds,
      assignedToIds: assignedToIds.length ? assignedToIds : undefined,
      requiresApproval: this.currentUser.role === 'HOD'
    };

    console.log('Payload:', payload);

    this.taskService.createTask(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = '✅ Task added successfully!';
        this.taskForm.reset();
        this.selectedUsersByDeptObj = {};
        this.taskForm.patchValue({ departmentIds: [], assignedToIds: [] });
        setTimeout(() => this.router.navigate(['/view-tasks']), 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Failed to add task.';
        console.error('Task creation error:', err);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/view-tasks']);
  }

  /** Helper: get department name */
  getDepartmentName(deptId: number): string {
    return this.departmentMap.get(deptId) || 'Unknown';
  }
}