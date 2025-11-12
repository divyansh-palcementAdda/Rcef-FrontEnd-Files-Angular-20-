import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskApiService } from '../../../Services/task-api-Service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { RequestApiService } from '../../../Services/request-api-service';
import { TaskDto } from '../../../Model/TaskDto';
import { Department } from '../../../Model/department';
import { userDto } from '../../../Model/userDto';
import { forkJoin, of, Subscription } from 'rxjs';
import { JwtService } from '../../../Services/jwt-service';
import { Modal } from 'bootstrap';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

interface EnrichedDepartment {
  id: number;
  name: string;
  hodName: string;
  userCount: number;
  users: userDto[];
}

interface CollapsedState {
  users: boolean;
  departments: boolean;
  requests: boolean;
}

@Component({
  selector: 'app-view-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-task.html',
  styleUrls: ['./view-task.css']
})
export class ViewTask implements OnInit, OnDestroy {
  task?: TaskDto;
  isStarting = false;
  isLoading = true;
  isApproving = false;
  isAssigned = false;
  isAddingReq = false;
  errorMessage = '';
  isForbidden = false;
  taskId!: number;
  currentUserRole = '';
  currentUserId = 0;
  currentUserDepartments: number[] = [];
  isHOD = false;

  todayDate = new Date().toISOString().split('T')[0];
  rejectionReason = '';
  rejectionRequestId?: number;
  extensionRequestId?: number;
  extensionDueDate?: string;

  private rejectionModal?: Modal;
  private extensionModal?: Modal;
  private addRequestModal?: Modal;

  assignedUsers: userDto[] = [];
  enrichedDepartments: EnrichedDepartment[] = [];
  collapsed: CollapsedState = { users: true, departments: true, requests: true };

  selectedRequestProofs: any[] = [];
  private modal?: Modal;
  private subscriptions = new Subscription();

  // Add Request Modal State
  newRequest: {
    requestType: 'CLOSURE' | 'EXTENSION' | null;
    remarks: string;
  } = { requestType: null, remarks: '' };

  selectedProofs: File[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskApiService,
    private deptService: DepartmentApiService,
    private userService: UserApiService,
    private jwtService: JwtService,
    private requestService: RequestApiService
  ) { }

  ngOnInit(): void {
    const taskId = Number(this.route.snapshot.paramMap.get('id'));
    this.taskId = taskId;
    if (!taskId || isNaN(taskId)) {
      this.errorMessage = 'Invalid Task ID';
      this.isLoading = false;
      return;
    }

    this.checkUserPermissions(taskId);
  }
 canEditDelete(): boolean {
    return !this.isHOD && this.currentUserRole!=="TEACHER";
  }

  editTask(): void {
    if (this.canEditDelete()) {
      console.log("Edit task")
this.router.navigate(['/edit-task'], { 
  queryParams: { taskId: this.taskId } 
});    }
  }
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // --- USER PERMISSION & TASK LOADING ---

  private checkUserPermissions(taskId: number): void {
    const token = this.jwtService.getAccessToken();
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const userId = this.jwtService.getUserIdFromToken(token);
    if (!userId) {
      this.errorMessage = 'Invalid session';
      this.isLoading = false;
      return;
    }
    this.currentUserId = userId;

    this.subscriptions.add(
      this.userService.getUserById(this.currentUserId).subscribe({
        next: (user) => {
          this.currentUserRole = user.role;
          this.isHOD = user.role === 'HOD';
          this.currentUserDepartments = user.departmentIds || [];

          if (this.currentUserRole === 'TEACHER') {
            this.verifyTeacherAccess(taskId);
          } else if (this.isHOD) {
            this.verifyHODAccess(taskId);
          } else {
            this.loadTask(taskId);
          }
        },
        error: () => {
          this.errorMessage = 'Failed to verify user';
          this.isLoading = false;
        }
      })
    );
  }

  private verifyTeacherAccess(taskId: number): void {
    this.taskService.getTaskById(taskId).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          this.errorMessage = 'Task not found';
          this.isLoading = false;
          return;
        }

        const assigned = res.data.assignedToIds || [];
        if (!assigned.includes(this.currentUserId)) {
          this.isForbidden = true;
          this.isLoading = false;
          return;
        }

        this.isAssigned = true;
        this.task = res.data;
        this.computeStats();      // <-- call once
        this.filterVisibleRequestsAndProofs();
        this.fetchRelatedEntities();
      },
      error: () => {
        this.isForbidden = true;
        this.isLoading = false;
      }
    });
  }

  private verifyHODAccess(taskId: number): void {
    this.taskService.getTaskById(taskId).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          this.errorMessage = 'Task not found';
          this.isLoading = false;
          return;
        }

        const taskDeptIds = res.data.departmentIds || [];
        const hasAccess = taskDeptIds.some(id => this.currentUserDepartments.includes(id));
        this.isAssigned = res.data.assignedToIds?.includes(this.currentUserId) || false;

        if (!hasAccess) {
          this.isForbidden = true;
          this.isLoading = false;
          return;
        }

        this.task = res.data;
        this.computeStats();      // <-- call once
        this.filterVisibleRequestsAndProofs();
        this.fetchRelatedEntities();
      },
      error: () => {
        this.isForbidden = true;
        this.isLoading = false;
      }
    });
  }

  private loadTask(taskId: number): void {
    this.taskService.getTaskById(taskId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.task = res.data;
          this.computeStats();      // <-- call once
          this.isAssigned = res.data.assignedToIds?.includes(this.currentUserId) || false;
          this.filterVisibleRequestsAndProofs();
          this.fetchRelatedEntities();
        } else {
          this.errorMessage = res.message ?? 'Task not found';
          this.isLoading = false;
        }
      },
      error: () => {
        this.errorMessage = 'Failed to load task';
        this.isLoading = false;
      }
    });
  }

  // --- FILTER REQUESTS BASED ON ROLE ---

  private filterVisibleRequestsAndProofs(): void {
    if (!this.task?.requests) return;

    if (this.currentUserRole === 'TEACHER') {
      // Only show requests made by current user
      this.task.requests = this.task.requests.filter(r => r.requestedBy === this.currentUserId);
    } else if (this.isHOD) {
      // HOD sees requests for tasks in their dept
      const deptIds = this.currentUserDepartments;
      this.task.requests = this.task.requests.filter(r =>
        this.task?.departmentIds?.some(d => deptIds.includes(d))
      );
    }
    // ADMIN sees all
  }

  // --- FETCH USERS & DEPARTMENTS ---

  private fetchRelatedEntities(): void {
    if (!this.task) return;

    const deptObs = this.task.departmentIds?.length
      ? this.deptService.getDepartmentsByIds(this.task.departmentIds)
      : of([]);

    const userObs = this.task.assignedToIds?.length
      ? this.userService.getUsersByIds(this.task.assignedToIds)
      : of([]);

    this.subscriptions.add(
      forkJoin([deptObs, userObs]).subscribe({
        next: ([departments, users]) => {
          this.assignedUsers = users;
          this.enrichDepartments(departments);
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Failed to load related data';
          this.isLoading = false;
        }
      })
    );
  }

  private enrichDepartments(departments: Department[]): void {
    this.enrichedDepartments = departments.map(dept => {
      const users = dept.users || [];
      const hod = users.find(u => u.role === 'HOD') || users[0];
      return {
        id: dept.departmentId,
        name: dept.name,
        hodName: hod ? hod.fullName : '—',
        userCount: users.length,
        users
      };
    });
  }

  // --- ADD REQUEST MODAL ---

  get isAssignedToCurrentUser(): boolean {
    return this.isAssigned;
  }

  openAddRequestModal(): void {
    this.newRequest = { requestType: null, remarks: '' };
    this.selectedProofs = [];
    this.addRequestModal = new Modal(document.getElementById('addRequestModal')!);
    this.addRequestModal.show();
  }

  onProofsSelected(event: any): void {
    const files: FileList = event.target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 10MB.`);
        continue;
      }
      this.selectedProofs.push(file);
    }
    event.target.value = '';
  }
  removeProof(index: number): void {
    this.selectedProofs.splice(index, 1);
  }
  addRequest(): void {
    // --- Validation ---
    if (!this.newRequest.requestType) {
      alert('Please select request type.');
      return;
    }
    if (this.newRequest.requestType === 'EXTENSION' && !this.newRequest.remarks?.trim()) {
      alert('Reason is required for extension.');
      return;
    }
    if (this.newRequest.requestType === 'CLOSURE' && this.selectedProofs.length === 0) {
      alert('At least one proof is required for closure.');
      return;
    }

    this.isAddingReq = true;

    const formData = new FormData();
    formData.append('requestType', this.newRequest.requestType);
    if (this.newRequest.remarks?.trim()) {
      formData.append('remarks', this.newRequest.remarks.trim());
    }
    this.selectedProofs.forEach(file => {
      formData.append('proofs', file, file.name);
    });

    this.requestService.createRequestWithProofs(this.taskId, formData).pipe(
      finalize(() => this.isAddingReq = false)
    ).subscribe({
      next: (res) => {
        if (res.success) {
          alert('Request submitted successfully!');
          this.addRequestModal?.hide();
          this.reloadTask();
        } else {
          alert(res.message || 'Failed to submit.');
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Server error.';
        alert('Error: ' + msg);
      }
    });
  }

  startTask(): void {
    if (!confirm('Do you want to start this task?')) {
      return;
    }

    this.isStarting = true;

    this.taskService.startTask(this.taskId).pipe(
      finalize(() => this.isStarting = false)
    ).subscribe({
      next: (res) => {
        if (res.success) {
          alert('Task started successfully!');
          this.reloadTask(); // Refresh task status
        } else {
          alert(res.message || 'Failed to start task.');
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Server error.';
        alert('Error: ' + msg);
      }
    });
  }
  // --- UI HELPERS ---

  toggleCollapse(section: 'users' | 'departments' | 'requests') {
    this.collapsed[section] = !this.collapsed[section];
  }
  private _stats: { label: string; count: number; color: string }[] = [];
  getTaskStats() { return this._stats; }

  private computeStats() {
    this._stats = [
      { label: 'Assigned Users', count: this.task?.assignedToIds?.length ?? 0, color: 'primary' },
      { label: 'Departments', count: this.task?.departmentIds?.length ?? 0, color: 'info' },
      { label: 'Requests', count: this.task?.requests?.length ?? 0, color: 'warning' },
      { label: 'Proofs', count: this.task?.proofs?.length ?? 0, color: 'success' }
    ];
  }

  formatStatus(status: string | undefined): string {
    return status ? status.replace(/_/g, ' ') : '—';
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'bg-warning text-dark',
      APPROVED: 'bg-success',
      REJECTED: 'bg-danger',
      REQUEST_FOR_CLOSURE: 'bg-info text-dark',
      REQUEST_FOR_EXTENSION: 'bg-info text-dark',
      UPCOMING: 'bg-light text-dark',
      DELAYED: 'bg-danger blink',
      CLOSED: 'bg-success',
      IN_PROGRESS: 'bg-secondary',
      EXTENDED: 'bg-secondary'
    };
    return map[status] || 'bg-secondary';
  }

  // getTaskStats() {
  //   return [
  //     { label: 'Users', count: this.assignedUsers.length, color: 'primary' },
  //     { label: 'Depts', count: this.enrichedDepartments.length, color: 'info' },
  //     {
  //       label: 'Approval',
  //       count: this.task?.requiresApproval ? 1 : 0,
  //       status: this.task?.requiresApproval ? 'Required' : 'Not Required',
  //       color: this.task?.requiresApproval ? 'danger' : 'success'
  //     },
  //     { label: 'Requests', count: this.task?.requests?.length ?? 0, color: 'warning' }
  //   ];
  // }

  openProofsModal(request: any): void {
    this.selectedRequestProofs = request.proofs || [];
    this.modal = new Modal(document.getElementById('proofsModal')!);
    this.modal.show();
  }

  getFileName(url: string): string {
    return url.split('/').pop()?.split('?')[0] || 'File';
  }

  // --- REQUEST APPROVAL / REJECTION ---

  approveClosureRequest(requestId: number): void {
    if (!confirm('Approve closure request?')) return;

    this.requestService.approveRequest(this.taskId, requestId, {}).subscribe({
      next: () => this.reloadTask(),
      error: () => alert('Failed to approve')
    });
  }

  showExtensionApprovalModal(request: any): void {
    this.extensionRequestId = request.requestId;
    this.extensionDueDate = undefined;
    this.extensionModal = new Modal(document.getElementById('extensionApprovalModal')!);
    this.extensionModal.show();
  }

 confirmExtensionApproval(): void {
  if (!this.extensionRequestId || !this.extensionDueDate) return;

  // --------------------------------------------------------------
  // 1. this.extensionDueDate is a string like "2025-11-20"
  // 2. Append "T00:00:00" → "2025-11-20T00:00:00"
  // --------------------------------------------------------------
  const isoDateTime = `${this.extensionDueDate}T00:00:00`;

  this.requestService.approveRequest(
    this.taskId,
    this.extensionRequestId,
    { newDueDate: isoDateTime }          // ← full LocalDateTime
  ).subscribe({
    next: () => {
      this.extensionModal?.hide();
      this.reloadTask();
    },
    error: (err) => {
      console.error('Approve failed:', err);
      alert('Failed to approve extension');
    }
  });
}
  showRejectionModal(request: any): void {
    this.rejectionRequestId = request.requestId;
    this.rejectionReason = '';
    this.rejectionModal = new Modal(document.getElementById('rejectionModal')!);
    this.rejectionModal.show();
  }

  confirmRejection(): void {
    if (!this.rejectionRequestId || !this.rejectionReason?.trim()) return;

    this.requestService.rejectRequest(
      this.taskId,
      this.rejectionRequestId,
      this.rejectionReason.trim()
    ).subscribe({
      next: () => {
        this.rejectionModal?.hide();
        this.reloadTask();
      },
      error: () => alert('Failed to reject')
    });
  }

  private reloadTask(): void {
    this.loadTask(this.taskId);
  }

  approveTask(): void {
    if (!this.task?.taskId || this.isApproving) return;
    if (!confirm('Approve entire task?')) return;

    this.isApproving = true;
    this.taskService.approveTask(this.task.taskId).subscribe({
      next: (res) => {
        if (res.success) this.task = res.data;
        alert(res.message || 'Task approved');
        this.isApproving = false;
      },
      error: () => {
        alert('Failed to approve task');
        this.isApproving = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/view-tasks']);
  }
}