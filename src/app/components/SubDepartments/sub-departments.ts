import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DepartmentApiService } from '../../Services/department-api-service';
import { UserApiService } from '../../Services/UserApiService';
import { Department } from '../../Model/department';
import { userDto } from '../../Model/userDto';

interface SubDepartment {
  id: string;
  name: string;
  code: string;
  description: string;
  department: Department;
}

@Component({
  selector: 'app-sub-departments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './sub-departments.html',
  styleUrls: ['./sub-departments.css']
})
export class SubDepartmentManagementComponent implements OnInit {
  activeTab: 'subdepts' | 'users' = 'subdepts';

  // State
  departments: Department[] = [];
  subDepartments: SubDepartment[] = [];
  users: userDto[] = [];

  selectedDepartment: Department | null = null;
  loadingDepartments = false;
  loadingSubDepts = false;
  loadingUsers = false;

  successMessage: string | null = null;
  errorMessage: string | null = null;

  newSubDept = {
    name: '',
    code: '',
    description: '',
    departmentId: null as number | null
  };

  // Editing User Relationship State
  editingUserId: number | null = null;
  editPayload = {
    departmentId: null as number | null,
    subDepartmentId: null as string | null,
    parentUserId: null as number | null
  };
  availableSubDeptsForEdit: SubDepartment[] = [];

  constructor(
    private deptApiService: DepartmentApiService,
    private userApiService: UserApiService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
  }

  // -------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------
  loadDepartments(): void {
    this.loadingDepartments = true;
    this.deptApiService.getAllDepartments().subscribe({
      next: (depts) => {
        this.departments = depts;
        this.loadingDepartments = false;
        if (depts.length > 0 && !this.selectedDepartment) {
          this.selectDepartment(depts[0]);
        }
      },
      error: (err) => {
        this.showError('Failed to load departments: ' + err.message);
        this.loadingDepartments = false;
      }
    });
  }

  selectDepartment(dept: Department): void {
    this.selectedDepartment = dept;
    this.loadingSubDepts = true;
    this.deptApiService.getSubDepartmentsByDepartment(dept.departmentId).subscribe({
      next: (subs) => {
        this.subDepartments = subs;
        this.loadingSubDepts = false;
      },
      error: (err) => {
        this.showError('Failed to load sub-departments: ' + err.message);
        this.loadingSubDepts = false;
      }
    });
  }

  loadUsersAndParentsData(): void {
    this.loadingUsers = true;
    this.userApiService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loadingUsers = false;
      },
      error: (err) => {
        this.showError('Failed to load users: ' + err.message);
        this.loadingUsers = false;
      }
    });
  }

  // -------------------------------------------------------------
  // Sub-Department CRUD Actions
  // -------------------------------------------------------------
  createSubDept(): void {
    if (!this.newSubDept.name || !this.newSubDept.code || !this.newSubDept.departmentId) {
      this.showError('All fields are required to create a sub-department');
      return;
    }

    this.deptApiService.createSubDepartment(this.newSubDept).subscribe({
      next: () => {
        this.showSuccess('Sub-department created successfully');
        if (this.selectedDepartment && this.selectedDepartment.departmentId === this.newSubDept.departmentId) {
          this.selectDepartment(this.selectedDepartment);
        }
        this.newSubDept = { name: '', code: '', description: '', departmentId: this.selectedDepartment?.departmentId || null };
      },
      error: (err) => this.showError('Failed to create sub-department: ' + err.message)
    });
  }

  deleteSubDept(id: string): void {
    if (!confirm('Are you sure you want to delete this sub-department? All user associations will be cleared.')) {
      return;
    }

    this.deptApiService.deleteSubDepartment(id).subscribe({
      next: () => {
        this.showSuccess('Sub-department deleted successfully');
        if (this.selectedDepartment) {
          this.selectDepartment(this.selectedDepartment);
        }
      },
      error: (err) => this.showError('Failed to delete sub-department: ' + err.message)
    });
  }

  // -------------------------------------------------------------
  // Inline Mapping Actions
  // -------------------------------------------------------------
  startEditMapping(u: userDto): void {
    this.editingUserId = u.userId;
    this.editPayload = {
      departmentId: u.departmentIds && u.departmentIds.length > 0 ? u.departmentIds[0] : null,
      subDepartmentId: u.subDepartmentId || null,
      parentUserId: u.parentUserId || null
    };

    if (this.editPayload.departmentId) {
      this.loadSubDeptsForEdit(this.editPayload.departmentId);
    } else {
      this.availableSubDeptsForEdit = [];
    }
  }

  loadSubDeptsForEdit(deptId: number): void {
    this.deptApiService.getSubDepartmentsByDepartment(deptId).subscribe({
      next: (subs) => {
        this.availableSubDeptsForEdit = subs;
      },
      error: (err) => console.error('Failed to load sub-departments for edit dropdown', err)
    });
  }

  onEditDeptChange(): void {
    this.editPayload.subDepartmentId = null;
    if (this.editPayload.departmentId) {
      this.loadSubDeptsForEdit(this.editPayload.departmentId);
    } else {
      this.availableSubDeptsForEdit = [];
    }
  }

  getPotentialParents(u: userDto): userDto[] {
    const role = (u.role || '').toUpperCase();
    switch (role) {
      case 'TEACHER':
        return this.users.filter(x => x.role === 'HOD' && x.userId !== u.userId);
      case 'HOD':
        return this.users.filter(x => (x.role === 'SUB_ADMIN' || x.role === 'ADMIN') && x.userId !== u.userId);
      case 'SUB_ADMIN':
        return this.users.filter(x => x.role === 'ADMIN' && x.userId !== u.userId);
      case 'ADMIN':
        return this.users.filter(x => x.role === 'SUPER_ADMIN' && x.userId !== u.userId);
      default:
        return [];
    }
  }

  saveEditMapping(userId: number): void {
    const payload: any = {};
    if (this.editPayload.departmentId) {
      payload.departmentIds = [this.editPayload.departmentId];
    }
    payload.subDepartmentId = this.editPayload.subDepartmentId;
    payload.parentUserId = this.editPayload.parentUserId;

    this.userApiService.updateUser(userId, payload).subscribe({
      next: () => {
        this.showSuccess('Relationship mapped successfully');
        this.editingUserId = null;
        this.loadUsersAndParentsData();
      },
      error: (err) => this.showError('Failed to update mapping: ' + err.message)
    });
  }

  getDepartmentNames(u: userDto): string {
    return u.departmentNames && u.departmentNames.length > 0 ? u.departmentNames.join(', ') : 'None';
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  goBack(): void {
    this.router.navigate(['/admin']);
  }

  showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = null;
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: ['snackbar-success'] });
  }

  showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = null;
    this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: ['snackbar-error'] });
  }
}
