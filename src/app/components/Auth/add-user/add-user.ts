import { CommonModule } from '@angular/common';
import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../Services/api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { SubjectApiService } from '../../../Services/subject-api.service';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './add-user.html',
  styleUrls: ['./add-user.css']
})
export class AddUserComponent implements OnInit {
  @Input() isModal = false;
  @Output() closed = new EventEmitter<boolean>();

  userForm: FormGroup;
  isSubmitting = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  roles: string[] = [];
  departments: any[] = [];
  selectedDepartments: number[] = [];
  searchQuery: string = '';

  showPassword = false;
  passwordStrength = { score: 0, label: '', color: '' };

  // OTP
  otpSent = false;
  otpValidated = false;
  otpInput = '';
  verifiedEmail: string | null = null;
  departmentId: string | null = null;

  // Hierarchy
  allUsers: any[] = [];
  filteredParentUsers: any[] = [];
  subDepartments: any[] = [];

  // Subjects
  subjects: any[] = [];
  subjectSearchQuery = '';
  showSubjectDropdown = false;
  activeItemIndex = -1;

  constructor(
    private fb: FormBuilder,
    private departmentApiService: DepartmentApiService,
    private apiService: ApiService,
    private userApiService: UserApiService,
    private authApiService: AuthApiService,
    private subjectApiService: SubjectApiService,
    private route : ActivatedRoute
  ) {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64), Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!]).{8,64}$/)]],
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.pattern(/^[A-Za-z ]{3,}$/)]],
      role: ['', Validators.required],
      departmentIds: [[], Validators.required],
      parentUserId: [null],
      reportingManagerIds: [[]],
      subDepartmentId: [null],
      subDepartmentIds: [[]],
      subjectIds: [[]]
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const deptIdStr = params['departmentId'];
      if (deptIdStr) {
        this.departmentId = deptIdStr;
        const deptId = +deptIdStr;
        this.selectedDepartments = [deptId];
        this.userForm.patchValue({ departmentIds: [deptId] });
        this.onDepartmentChange();
      }
    });
    console.log('Preselected Department ID:', this.departmentId);
    this.loadDepartments();
    this.loadAllUsers();
    this.loadSubjects();

    // Set dynamic roles list based on logged-in user role
    const currentRole = this.authApiService.getCurrentRole() || '';
    const allRolesList = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'HOD', 'TEACHER'];
    const currentIdx = allRolesList.indexOf(currentRole);
    this.roles = currentIdx !== -1 ? allRolesList.slice(currentIdx + 1) : ['HOD', 'TEACHER'];

    this.userForm.get('password')?.valueChanges.subscribe(value => {
      this.passwordStrength = this.evaluatePasswordStrength(value || '');
    });

    this.userForm.get('role')?.valueChanges.subscribe(role => {
      this.onRoleChange(role);
      const parentControl = this.userForm.get('reportingManagerIds');
      if (role && role !== 'SUPER_ADMIN') {
        parentControl?.setValidators([Validators.required, Validators.minLength(1)]);
      } else {
        parentControl?.clearValidators();
      }
      parentControl?.updateValueAndValidity();

      const deptControl = this.userForm.get('departmentIds');
      if (role === 'SUPER_ADMIN') {
        deptControl?.clearValidators();
        deptControl?.setValue([]);
      } else {
        deptControl?.setValidators([Validators.required]);
      }
      deptControl?.updateValueAndValidity();

      const subDeptControl = this.userForm.get('subDepartmentId');
      const subDeptsControl = this.userForm.get('subDepartmentIds');
      if (role === 'HOD' || role === 'TEACHER') {
        subDeptControl?.setValidators([Validators.required]);
        subDeptsControl?.setValidators([Validators.required]);
      } else {
        subDeptControl?.clearValidators();
        subDeptControl?.setValue(null);
        subDeptsControl?.clearValidators();
        subDeptsControl?.setValue([]);
      }
      subDeptControl?.updateValueAndValidity();
      subDeptsControl?.updateValueAndValidity();
    });

    this.userForm.get('subDepartmentId')?.valueChanges.subscribe(() => {
      this.reloadSubjects();
    });
    this.userForm.get('subDepartmentIds')?.valueChanges.subscribe(() => {
      this.reloadSubjects();
    });
  }

  loadAllUsers(): void {
    this.userApiService.getAllUsers().subscribe({
      next: (users) => {
        this.allUsers = users;
      },
      error: (err) => console.error('Failed to load users for parent selection', err)
    });
  }

  onRoleChange(selectedRole: string): void {
    this.filteredParentUsers = [];
    this.userForm.get('reportingManagerIds')?.setValue([]);
    this.userForm.get('parentUserId')?.setValue(null);

    if (selectedRole && selectedRole !== 'SUPER_ADMIN') {
      this.userApiService.getEligibleManagers(selectedRole).subscribe({
        next: (managers) => {
          this.filteredParentUsers = managers;
        },
        error: (err) => console.error('Failed to load eligible managers for role ' + selectedRole, err)
      });
    }
  }

  onDepartmentChange(): void {
    this.subDepartments = [];
    this.userForm.get('subDepartmentId')?.setValue(null);
    if (this.selectedDepartments && this.selectedDepartments.length > 0) {
      const requests = this.selectedDepartments.map(id => this.departmentApiService.getSubDepartmentsByDepartment(id));
      forkJoin(requests).subscribe({
        next: (results) => {
          this.subDepartments = results.flat();
        },
        error: (err) => console.error('Failed to load sub-departments', err)
      });
    }
  }

  loadDepartments(): void {
    this.departmentApiService.getAllDepartments().subscribe({
      next: (data) => (this.departments = data),
      error: (err) => console.error('Failed to load departments', err)
    });
  }

  loadSubjects(): void {
    // Keep for backward compatibility or initial empty load
    this.reloadSubjects();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  evaluatePasswordStrength(password: string) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[@#$%^&+=!]/.test(password)) score++;
    if (score <= 2) return { score: 20, label: 'Weak', color: '#e74a3b' };
    if (score <= 4) return { score: 60, label: 'Medium', color: '#f6c23e' };
    return { score: 100, label: 'Strong', color: '#1cc88a' };
  }

  filteredDepartments() {
    if (!this.searchQuery.trim()) return this.departments;
    return this.departments.filter((d) =>
      d.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  updateDepartmentSelection(event: any, deptId: number) {
    const role = this.userForm.get('role')?.value;

    if (role === 'HOD' || role === 'SUB_ADMIN') {
      this.selectedDepartments = event.target.checked ? [deptId] : [];
    } else {
      if (event.target.checked) {
        if (!this.selectedDepartments.includes(deptId)) {
          this.selectedDepartments.push(deptId);
        }
      } else {
        this.selectedDepartments = this.selectedDepartments.filter((id) => id !== deptId);
      }
    }

    this.userForm.get('departmentIds')?.setValue(this.selectedDepartments);
    this.onDepartmentChange();
    this.reloadSubjects();
  }

  isDeptDisabled(dept: any): boolean {
    const role = this.userForm.get('role')?.value;
    if ((role === 'HOD' || role === 'SUB_ADMIN') && this.selectedDepartments.length >= 1 && !this.selectedDepartments.includes(dept.departmentId))
      return true;
    return false;
  }

  /** OTP Send */
  sendOtp(): void {
    const email = this.userForm.value.email;
    if (!email) {
      this.errorMessage = 'Please enter an email first';
      return;
    }

    this.apiService.sendOtp({ email }).subscribe({
      next: (res: any) => {
        if (res.success && res.status === 'OTP_SENT') {
          this.successMessage = res.message;
          this.otpSent = true;
          this.errorMessage = null;
        }
      },
      error: (err) => (this.errorMessage = err.error?.message || 'Failed to send OTP')
    });
  }

  /** OTP Verify */
  verifyOtp(): void {
    const email = this.userForm.value.email;
    if (!this.otpInput) {
      this.errorMessage = 'Please enter OTP';
      return;
    }

    this.apiService.validateOtp({ email, otp: this.otpInput }).subscribe({
      next: () => {
        this.successMessage = 'OTP verified successfully!';
        this.otpValidated = true;
        this.verifiedEmail = email;
        this.userForm.get('email')?.disable();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Invalid OTP';
        this.otpValidated = false;
      }
    });
  }

  /** Submit form */
  onSubmit(): void {
    if (!this.otpValidated) {
      this.errorMessage = 'Please verify OTP first';
      return;
    }

    if (this.userForm.invalid) {
      this.errorMessage = 'Please fill all required fields correctly.';
      this.userForm.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.userForm.getRawValue(),
      email: this.verifiedEmail,
      departmentIds: this.selectedDepartments
    };

    this.isSubmitting = true;
    this.userApiService.createUser(payload).subscribe({
      next: () => {
        this.successMessage = '✅ User created successfully!';
        this.userForm.reset();
        this.selectedDepartments = [];
        this.otpSent = false;
        this.otpValidated = false;
        this.otpInput = '';
        this.verifiedEmail = null;
        this.isSubmitting = false;
        setTimeout(() => {
          if (this.isModal) {
            this.closed.emit(true);
          } else {
            this.authApiService.goToDashboard();
          }
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Failed to create user.';
      }
    });
  }

  cancel(): void {
    if (this.isModal) {
      this.closed.emit(false);
    } else {
      this.authApiService.goToDashboard();
    }
  }

  // ===========================================================
  // Searchable Multiselect Helpers
  // ===========================================================
  reloadSubjects(): void {
    const selectedDeptIds = this.selectedDepartments || [];
    const subDeptId = this.userForm.get('subDepartmentId')?.value;

    if (selectedDeptIds.length === 0 && !subDeptId) {
      this.subjects = [];
      this.userForm.get('subjectIds')?.setValue([]);
      return;
    }

    if (subDeptId) {
      this.subjectApiService.getSubjects(null, subDeptId).subscribe({
        next: (subs) => {
          this.subjects = subs;
          this.validateSelectedSubjects();
        },
        error: (err) => console.error('Failed to load subjects', err)
      });
    } else if (selectedDeptIds.length > 0) {
      const requests = selectedDeptIds.map(id => this.subjectApiService.getSubjects(id, null));
      forkJoin(requests).subscribe({
        next: (results) => {
          const merged = results.flat();
          const unique = merged.filter((sub, index, self) =>
            index === self.findIndex((t) => t.id === sub.id)
          );
          this.subjects = unique;
          this.validateSelectedSubjects();
        },
        error: (err) => console.error('Failed to load subjects for departments', err)
      });
    }
  }

  validateSelectedSubjects(): void {
    const currentSelected: number[] = this.userForm.get('subjectIds')?.value || [];
    const validSelected = currentSelected.filter(id =>
      this.subjects.some(sub => sub.id === id)
    );
    this.userForm.get('subjectIds')?.setValue(validSelected);
  }

  isSubjectSelected(id: number): boolean {
    const selected = this.userForm.get('subjectIds')?.value || [];
    return selected.includes(id);
  }

  getSelectedSubjectIds(): number[] {
    return this.userForm.get('subjectIds')?.value || [];
  }

  getSubjectName(id: number): string {
    const sub = this.subjects.find(s => s.id === id);
    return sub ? sub.subjectName : `Subject #${id}`;
  }

  filteredSubjectsList(): any[] {
    const q = this.subjectSearchQuery.toLowerCase().trim();
    if (!q) return this.subjects;
    return this.subjects.filter(sub =>
      sub.subjectName.toLowerCase().includes(q) ||
      (sub.subjectCode && sub.subjectCode.toLowerCase().includes(q))
    );
  }

  toggleSubjectSelection(id: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const control = this.userForm.get('subjectIds');
    const current: number[] = control?.value || [];
    let updated: number[];

    if (current.includes(id)) {
      updated = current.filter(x => x !== id);
    } else {
      updated = [...current, id];
      // Auto Assignment Logic:
      const subjectObj = this.subjects.find(s => s.id === id);
      if (subjectObj) {
        if (!this.selectedDepartments.includes(subjectObj.departmentId)) {
          this.selectedDepartments = [...this.selectedDepartments, subjectObj.departmentId];
          this.userForm.get('departmentIds')?.setValue(this.selectedDepartments);
          this.onDepartmentChange();
        }
        if (subjectObj.subDepartmentId && !this.userForm.get('subDepartmentId')?.value) {
          this.userForm.get('subDepartmentId')?.setValue(subjectObj.subDepartmentId);
        }
      }
    }
    control?.setValue(updated);
    control?.markAsTouched();
    control?.markAsDirty();
  }

  removeSubject(id: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.userForm.get('subjectIds');
    const current: number[] = control?.value || [];
    control?.setValue(current.filter(x => x !== id));
    control?.markAsTouched();
    control?.markAsDirty();
  }

  focusSearchInput(event: Event): void {
    if ((event.target as HTMLElement).tagName !== 'BUTTON') {
      const inputEl = document.querySelector('input[placeholder="🔍 Search Subject..."]') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
      }
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showSubjectDropdown = false;
      this.activeItemIndex = -1;
    }, 250);
  }

  handleMultiselectKeydown(event: KeyboardEvent): void {
    const list = this.filteredSubjectsList();
    if (!this.showSubjectDropdown) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.showSubjectDropdown = true;
        this.activeItemIndex = 0;
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      this.activeItemIndex = (this.activeItemIndex + 1) % list.length;
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.activeItemIndex = (this.activeItemIndex - 1 + list.length) % list.length;
      event.preventDefault();
    } else if (event.key === 'Enter') {
      if (this.activeItemIndex >= 0 && this.activeItemIndex < list.length) {
        this.toggleSubjectSelection(list[this.activeItemIndex].id);
        event.preventDefault();
      }
    } else if (event.key === 'Escape') {
      this.showSubjectDropdown = false;
      this.activeItemIndex = -1;
      event.preventDefault();
    }
  }

  showSubDeptDropdown = false;

  getSelectedSubDeptIds(): string[] {
    return this.userForm.get('subDepartmentIds')?.value || [];
  }

  getSubDeptName(id: string): string {
    const sub = this.subDepartments.find(s => s.id === id);
    return sub ? sub.name : 'Sub-Dept';
  }

  isSubDeptSelected(id: string): boolean {
    return this.getSelectedSubDeptIds().includes(id);
  }

  toggleSubDeptSelection(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.userForm.get('subDepartmentIds');
    const current: string[] = control?.value || [];
    let updated: string[];
    if (current.includes(id)) {
      updated = current.filter(x => x !== id);
    } else {
      updated = [...current, id];
    }
    control?.setValue(updated);
    this.userForm.get('subDepartmentId')?.setValue(updated.length > 0 ? updated[0] : null);
    control?.markAsTouched();
    this.reloadSubjects();
  }

  removeSubDept(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.userForm.get('subDepartmentIds');
    const current: string[] = control?.value || [];
    const updated = current.filter(x => x !== id);
    control?.setValue(updated);
    this.userForm.get('subDepartmentId')?.setValue(updated.length > 0 ? updated[0] : null);
    control?.markAsTouched();
    this.reloadSubjects();
  }

  showManagerDropdown = false;
  managerSearchQuery = '';

  getSelectedManagerIds(): number[] {
    return this.userForm.get('reportingManagerIds')?.value || [];
  }

  getManagerName(id: number): string {
    const mgr = this.filteredParentUsers.find(u => u.userId === id);
    return mgr ? mgr.fullName : `User #${id}`;
  }

  isManagerSelected(id: number): boolean {
    return this.getSelectedManagerIds().includes(id);
  }

  toggleManagerSelection(id: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const control = this.userForm.get('reportingManagerIds');
    const current: number[] = control?.value || [];
    let updated: number[];
    if (current.includes(id)) {
      updated = current.filter(x => x !== id);
    } else {
      updated = [...current, id];
    }
    control?.setValue(updated);
    control?.markAsTouched();
    control?.markAsDirty();

    // Set first manager as parentUserId for backward compatibility
    this.userForm.get('parentUserId')?.setValue(updated.length > 0 ? updated[0] : null);
  }

  removeManager(id: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const control = this.userForm.get('reportingManagerIds');
    const current: number[] = control?.value || [];
    const updated = current.filter(x => x !== id);
    control?.setValue(updated);
    control?.markAsTouched();
    control?.markAsDirty();

    this.userForm.get('parentUserId')?.setValue(updated.length > 0 ? updated[0] : null);
  }

  filteredManagersList(): any[] {
    const q = this.managerSearchQuery.toLowerCase().trim();
    if (!q) return this.filteredParentUsers;
    return this.filteredParentUsers.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-multiselect-container')) {
      this.showSubDeptDropdown = false;
      this.showSubjectDropdown = false;
      this.showManagerDropdown = false;
    }
  }
}
