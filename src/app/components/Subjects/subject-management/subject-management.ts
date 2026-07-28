import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SubjectApiService } from '../../../Services/subject-api.service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { AuthApiService } from '../../../Services/auth-api-service';
import { Department } from '../../../Model/department';
import { SubjectDto, SubjectRequest, SubjectAnalytics } from '../../../Model/subject';
import { userDto } from '../../../Model/userDto';


interface SubDepartment {
  id: string;
  name: string;
  code: string;
  department?: Department;
}

@Component({
  selector: 'app-subject-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './subject-management.html',
  styleUrls: ['./subject-management.css']
})
export class SubjectManagementComponent implements OnInit {

  // ---- Tab ----
  activeTab: 'subjects' | 'assign' | 'analytics' = 'subjects';

  // ---- Data ----
  departments: Department[] = [];
  subDepartments: SubDepartment[] = [];
  subjects: SubjectDto[] = [];
  users: userDto[] = [];
  selectedAnalytics: SubjectAnalytics | null = null;
  analyticsSubjectId: number | null = null;

  // ---- Loading flags ----
  loadingDepts = false;
  loadingSubDepts = false;
  loadingSubjects = false;
  loadingUsers = false;
  loadingAnalytics = false;

  // ---- Filters ----
  selectedDeptId: number | null = null;
  selectedSubDeptId: string | null = null;

  // ---- Form state ----
  isEditing = false;
  showCreateForm = false;
  editingId: number | null = null;
  form: SubjectRequest = {
    subjectName: '',
    description: '',
    departmentId: 0,
    subDepartmentId: ''
  };
  formSubDepts: SubDepartment[] = [];
  saving = false;

  // ---- User assignment ----
  assignSubjectId: number | null = null;
  assignSubjectName = '';
  assignedUserIds: number[] = [];
  selectedUserIdsToAdd: number[] = [];
  assignSubDeptId: string | null = null;
  assignableUsers: userDto[] = [];
  loadingAssignedUsers = false;
  savingAssignment = false;

  constructor(
    private subjectApi: SubjectApiService,
    private deptApi: DepartmentApiService,
    private userApi: UserApiService,
    private authSrv: AuthApiService,
    private snackBar: MatSnackBar,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
    // Only pre-load all users for admin roles; HOD users are loaded per sub-department when needed
    const role = this.authSrv.getCurrentRole();
    if (role !== 'HOD') {
      this.loadUsers();
    }
  }

  // ===================================================
  // DATA LOADERS
  // ===================================================
  loadDepartments(): void {
    this.loadingDepts = true;
    this.deptApi.getAllDepartments().subscribe({
      next: (depts: Department[]) => {
        this.departments = depts;
        this.loadingDepts = false;
      },
      error: (err: any) => {
        this.showError('Failed to load departments: ' + err.message);
        this.loadingDepts = false;
      }
    });
  }

  loadSubDepts(deptId: number): void {
    this.loadingSubDepts = true;
    this.subDepartments = [];
    this.deptApi.getSubDepartmentsByDepartment(deptId).subscribe({
      next: (subs: any[]) => {
        this.subDepartments = subs;
        this.loadingSubDepts = false;
      },
      error: (err: any) => {
        this.showError('Failed to load sub-departments: ' + err.message);
        this.loadingSubDepts = false;
      }
    });
  }

  loadSubjects(): void {
    this.loadingSubjects = true;
    const call = this.selectedSubDeptId
      ? this.subjectApi.getSubjectsBySubDepartment(this.selectedSubDeptId)
      : this.selectedDeptId
      ? this.subjectApi.getSubjectsByDepartment(this.selectedDeptId)
      : this.subjectApi.getAllSubjects();

    call.subscribe({
      next: (subs: SubjectDto[]) => {
        this.subjects = subs;
        this.loadingSubjects = false;
      },
      error: (err: any) => {
        this.showError('Failed to load subjects: ' + err.message);
        this.loadingSubjects = false;
      }
    });
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.userApi.getAllUsers().subscribe({
      next: (users: userDto[]) => {
        this.users = users;
        this.loadingUsers = false;
      },
      error: (err: any) => {
        // For HOD, getAllUsers may return 403 — silently ignore, users loaded per sub-dept on assign
        console.warn('getAllUsers failed (expected for HOD role):', err.message);
        this.loadingUsers = false;
      }
    });
  }

  // ===================================================
  // FILTER HANDLERS
  // ===================================================
  onDeptChange(): void {
    this.selectedSubDeptId = null;
    if (this.selectedDeptId) {
      this.loadSubDepts(this.selectedDeptId);
    }
    this.loadSubjects();
  }

  onSubDeptChange(): void {
    this.loadSubjects();
  }

  // ===================================================
  // FORM HANDLERS
  // ===================================================
  openCreate(): void {
    this.isEditing = false;
    this.showCreateForm = true;
    this.editingId = null;
    this.form = {
      subjectName: '',
      description: '',
      departmentId: this.selectedDeptId || 0,
      subDepartmentId: this.selectedSubDeptId || ''
    };
    this.formSubDepts = [...this.subDepartments];
    if (this.form.departmentId) {
      this.loadFormSubDepts(this.form.departmentId);
    }
  }

  openEdit(subject: SubjectDto): void {
    this.isEditing = true;
    this.editingId = subject.id;
    this.form = {
      subjectName: subject.subjectName,
      description: subject.description || '',
      departmentId: subject.departmentId,
      subDepartmentId: subject.subDepartmentId,
      isActive: subject.isActive
    };
    this.loadFormSubDepts(subject.departmentId);
  }

  onFormDeptChange(): void {
    this.form.subDepartmentId = '';
    this.formSubDepts = [];
    if (this.form.departmentId) {
      this.loadFormSubDepts(this.form.departmentId);
    }
  }

  loadFormSubDepts(deptId: number): void {
    this.deptApi.getSubDepartmentsByDepartment(deptId).subscribe({
      next: (subs: any[]) => { this.formSubDepts = subs; },
      error: (err: any) => this.showError('Failed to load sub-departments: ' + err.message)
    });
  }

  saveSubject(): void {
    if (!this.form.subjectName || !this.form.departmentId || !this.form.subDepartmentId) {
      this.showError('Subject name, department, and sub-department are required');
      return;
    }

    this.saving = true;
    const call = this.isEditing && this.editingId
      ? this.subjectApi.updateSubject(this.editingId, this.form)
      : this.subjectApi.createSubject(this.form);

    call.subscribe({
      next: () => {
        this.showSuccess(this.isEditing ? 'Subject updated successfully' : 'Subject created successfully');
        this.saving = false;
        this.editingId = null;
        this.isEditing = false;
        this.showCreateForm = false;
        this.loadSubjects();
      },
      error: (err: any) => {
        this.showError('Failed to save subject: ' + err.message);
        this.saving = false;
      }
    });
  }

  cancelForm(): void {
    this.isEditing = false;
    this.showCreateForm = false;
    this.editingId = null;
  }

  deleteSubject(subject: SubjectDto): void {
    if (!confirm(`Deactivate subject "${subject.subjectName}"? It can be reactivated later.`)) return;
    this.subjectApi.deleteSubject(subject.id).subscribe({
      next: () => {
        this.showSuccess('Subject deactivated');
        this.loadSubjects();
      },
      error: (err: any) => this.showError('Failed to deactivate: ' + err.message)
    });
  }

  activateSubject(subject: SubjectDto): void {
    this.subjectApi.activateSubject(subject.id).subscribe({
      next: () => {
        this.showSuccess('Subject activated');
        this.loadSubjects();
      },
      error: (err: any) => this.showError('Failed to activate: ' + err.message)
    });
  }

  viewDetail(subject: SubjectDto): void {
    this.router.navigate(['/subject', subject.id]);
  }

  // ===================================================
  // USER ASSIGNMENT TAB
  // ===================================================
  openAssignTab(subject: SubjectDto): void {
    this.activeTab = 'assign';
    this.assignSubjectId = subject.id;
    this.assignSubjectName = subject.subjectName;
    this.assignSubDeptId = subject.subDepartmentId;
    this.selectedUserIdsToAdd = [];
    // Load users for this subject's sub-department if not already loaded
    if (this.assignSubDeptId) {
      this.loadUsersForSubDept(this.assignSubDeptId);
    }
    this.loadAssignedUsers(subject.id);
  }

  loadUsersForSubDept(subDeptId: string): void {
    this.loadingUsers = true;
    this.userApi.getAllUsersBySubDepartment(subDeptId).subscribe({
      next: (users: userDto[]) => {
        // Merge with existing users (avoid duplicates)
        const existingIds = new Set(this.users.map(u => u.userId));
        const newUsers = users.filter(u => !existingIds.has(u.userId));
        this.users = [...this.users, ...newUsers];
        this.loadingUsers = false;
      },
      error: (err: any) => {
        this.showError('Failed to load users for sub-department: ' + err.message);
        this.loadingUsers = false;
      }
    });
  }

  loadAssignedUsers(subjectId: number): void {
    this.loadingAssignedUsers = true;
    this.subjectApi.getUsersForSubject(subjectId).subscribe({
      next: (users: any[]) => {
        this.assignedUserIds = users.map((u: any) => u.userId);
        this.loadingAssignedUsers = false;
      },
      error: (err: any) => {
        this.showError('Failed to load assigned users: ' + err.message);
        this.loadingAssignedUsers = false;
      }
    });
  }

  get unassignedUsers(): userDto[] {
    return this.users.filter(u =>
      !this.assignedUserIds.includes(u.userId) &&
      (
        this.assignSubDeptId
          // Check both the array field (subDepartmentIds) and the legacy single field (subDepartmentId)
          ? (u.subDepartmentIds?.includes(this.assignSubDeptId) || u.subDepartmentId === this.assignSubDeptId)
          : true
      )
    );
  }

  get assignedUsers(): userDto[] {
    return this.users.filter(u => this.assignedUserIds.includes(u.userId));
  }

  toggleUserSelection(userId: number): void {
    const idx = this.selectedUserIdsToAdd.indexOf(userId);
    if (idx >= 0) {
      this.selectedUserIdsToAdd.splice(idx, 1);
    } else {
      this.selectedUserIdsToAdd.push(userId);
    }
  }

  isUserSelected(userId: number): boolean {
    return this.selectedUserIdsToAdd.includes(userId);
  }

  assignSelectedUsers(): void {
    if (!this.assignSubjectId || this.selectedUserIdsToAdd.length === 0) return;
    this.savingAssignment = true;
    this.subjectApi.assignUsers(this.assignSubjectId, this.selectedUserIdsToAdd).subscribe({
      next: () => {
        this.showSuccess('Users assigned successfully');
        this.selectedUserIdsToAdd = [];
        this.loadAssignedUsers(this.assignSubjectId!);
        this.savingAssignment = false;
      },
      error: (err: any) => {
        this.showError('Failed to assign users: ' + err.message);
        this.savingAssignment = false;
      }
    });
  }

  removeUser(userId: number): void {
    if (!this.assignSubjectId) return;
    this.subjectApi.removeUsers(this.assignSubjectId, [userId]).subscribe({
      next: () => {
        this.showSuccess('User removed from subject');
        this.loadAssignedUsers(this.assignSubjectId!);
      },
      error: (err: any) => this.showError('Failed to remove user: ' + err.message)
    });
  }

  // ===================================================
  // ANALYTICS TAB
  // ===================================================
  loadAnalytics(subject: SubjectDto): void {
    this.activeTab = 'analytics';
    this.analyticsSubjectId = subject.id;
    this.selectedAnalytics = null;
    this.loadingAnalytics = true;
    this.subjectApi.getSubjectAnalytics(subject.id).subscribe({
      next: (analytics: SubjectAnalytics) => {
        this.selectedAnalytics = analytics;
        this.loadingAnalytics = false;
      },
      error: (err: any) => {
        this.showError('Failed to load analytics: ' + err.message);
        this.loadingAnalytics = false;
      }
    });
  }

  // ===================================================
  // HELPERS
  // ===================================================
  getDeptName(deptId: number): string {
    return this.departments.find(d => d.departmentId === deptId)?.name || '';
  }

  showSuccess(msg: string): void {
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: ['snackbar-success'] });
  }

  showError(msg: string): void {
    this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: ['snackbar-error'] });
  }

  goBack(): void {
    this.router.navigate(['/admin']);
  }
}
