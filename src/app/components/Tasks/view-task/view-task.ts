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
  instances: boolean;
}

interface TaskStats {
  label: string;
  count: number;
  color: string;
  icon?: string;
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
  isLoadingInstances = false;
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
  private viewInstanceModal?: Modal;

  assignedUsers: userDto[] = [];
  enrichedDepartments: EnrichedDepartment[] = [];
  collapsed: CollapsedState = { 
    users: true, 
    departments: true, 
    requests: true, 
    instances: true 
  };
  
  // Recurred Instances
  recurredInstances: TaskDto[] = [];
  selectedInstance?: TaskDto;

  selectedRequestProofs: any[] = [];
  private proofsModal?: Modal;
  private subscriptions = new Subscription();

  // Add Request Modal State
  newRequest: {
    requestType: 'CLOSURE' | 'EXTENSION' | null;
    remarks: string;
  } = { requestType: null, remarks: '' };

  selectedProofs: File[] = [];

  // Enhanced stats with icons
  private _stats: TaskStats[] = [];

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
    return !this.isHOD && this.currentUserRole !== "TEACHER";
  }

  editTask(): void {
    if (this.canEditDelete()) {
      console.log("Edit task");
      this.router.navigate(['/edit-task'], { 
        queryParams: { taskId: this.taskId } 
      });
    }
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
        error: (error) => {
          console.error('Failed to verify user:', error);
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
        this.computeStats();
        this.filterVisibleRequestsAndProofs();
        this.fetchRelatedEntities();
      },
      error: (error) => {
        console.error('Teacher access verification failed:', error);
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
        this.computeStats();
        this.filterVisibleRequestsAndProofs();
        this.fetchRelatedEntities();
      },
      error: (error) => {
        console.error('HOD access verification failed:', error);
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
          console.log('Task loaded successfully:', this.task);

          this.computeStats();
          this.isAssigned = res.data.assignedToIds?.includes(this.currentUserId) || false;
          this.filterVisibleRequestsAndProofs();
          this.fetchRelatedEntities();
          
          // Load recurred instances if task is recurring and user is admin
          if (this.task.isRecurring && this.currentUserRole === 'ADMIN') {
            this.loadRecurredInstances();
          }
        } else {
          this.errorMessage = res.message ?? 'Task not found';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Failed to load task:', error);
        this.errorMessage = 'Failed to load task. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // --- LOAD RECURRED INSTANCES ---
  
  private loadRecurredInstances(): void {
    if (!this.taskId) return;
    
    this.isLoadingInstances = true;
    
    this.taskService.getRecurredInstances(this.taskId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.recurredInstances = res.data.sort((a, b) => 
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          );
          console.log('Recurred instances loaded:', this.recurredInstances.length);
        } else {
          console.log('No recurred instances found:', res.message);
          this.recurredInstances = [];
        }
        this.isLoadingInstances = false;
      },
      error: (error) => {
        console.error('Failed to load recurred instances:', error);
        this.recurredInstances = [];
        this.isLoadingInstances = false;
      }
    });
  }

  // --- VIEW INSTANCE DETAILS ---
  
  viewInstanceDetails(instanceId: number): void {
    // First try to find in cached instances
    const cachedInstance = this.recurredInstances.find(i => i.taskId === instanceId);
    
    if (cachedInstance) {
      this.selectedInstance = cachedInstance;
      this.openViewInstanceModal();
    } else {
      // Fetch fresh data if not in cache
      this.isLoading = true;
      this.taskService.getTaskById(instanceId).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.selectedInstance = res.data;
            this.openViewInstanceModal();
          } else {
            alert('Failed to load instance details');
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading instance details:', error);
          alert('Failed to load instance details');
          this.isLoading = false;
        }
      });
    }
  }

  private openViewInstanceModal(): void {
    if (!this.selectedInstance) return;
    
    this.viewInstanceModal = new Modal(document.getElementById('viewInstanceModal')!);
    this.viewInstanceModal.show();
  }

  viewTaskById(taskId: number): void {
    if (!taskId) return;
    
    // Close modal first
    this.viewInstanceModal?.hide();
    
    // Navigate to the instance task
    this.router.navigate(['/task', taskId]);
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
        error: (error) => {
          console.error('Failed to load related data:', error);
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
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        alert(`File "${file.name}" exceeds 10MB limit.`);
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
    // Validation
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
          alert(res.message || 'Failed to submit request.');
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Server error. Please try again.';
        alert('Error: ' + msg);
        console.error('Error adding request:', err);
      }
    });
  }

  startTask(): void {
    if (!confirm('Are you sure you want to start this task?')) {
      return;
    }

    this.isStarting = true;

    this.taskService.startTask(this.taskId).pipe(
      finalize(() => this.isStarting = false)
    ).subscribe({
      next: (res) => {
        if (res.success) {
          alert('Task started successfully!');
          this.reloadTask();
        } else {
          alert(res.message || 'Failed to start task.');
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'Server error. Please try again.';
        alert('Error: ' + msg);
        console.error('Error starting task:', err);
      }
    });
  }

  // --- UI HELPERS ---

  toggleCollapse(section: 'users' | 'departments' | 'requests' | 'instances') {
    this.collapsed[section] = !this.collapsed[section];
    
    // Auto-load instances when section is opened
    if (section === 'instances' && !this.collapsed.instances && 
        this.task?.isRecurring && this.currentUserRole === 'ADMIN' &&
        this.recurredInstances.length === 0) {
      this.loadRecurredInstances();
    }
  }

  getTaskStats(): TaskStats[] { 
    return this._stats; 
  }

  private computeStats() {
    this._stats = [
      { 
        label: 'Assigned Users', 
        count: this.task?.assignedToIds?.length ?? 0, 
        color: 'primary',
        icon: 'bi-people'
      },
      { 
        label: 'Departments', 
        count: this.task?.departmentIds?.length ?? 0, 
        color: 'info',
        icon: 'bi-diagram-3'
      },
      { 
        label: 'Requests', 
        count: this.task?.requests?.length ?? 0, 
        color: 'warning',
        icon: 'bi-journal-text'
      },
      { 
        label: 'Proofs', 
        count: this.task?.proofs?.length ?? 0, 
        color: 'success',
        icon: 'bi-paperclip'
      }
    ];
  }

  formatStatus(status: string | undefined): string {
    if (!status) return '—';
    
    const statusMap: Record<string, string> = {
      'PENDING': 'Pending',
      'APPROVED': 'Approved',
      'REJECTED': 'Rejected',
      'REQUEST_FOR_CLOSURE': 'Request for Closure',
      'REQUEST_FOR_EXTENSION': 'Request for Extension',
      'UPCOMING': 'Upcoming',
      'DELAYED': 'Delayed',
      'CLOSED': 'Closed',
      'IN_PROGRESS': 'In Progress',
      'EXTENDED': 'Extended',
      'CANCELLED': 'Cancelled'
    };
    
    return statusMap[status] || status.replace(/_/g, ' ');
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'PENDING': 'bg-warning text-dark',
      'APPROVED': 'bg-success text-white',
      'REJECTED': 'bg-danger text-white',
      'REQUEST_FOR_CLOSURE': 'bg-info text-dark',
      'REQUEST_FOR_EXTENSION': 'bg-info text-dark',
      'UPCOMING': 'bg-light text-dark',
      'DELAYED': 'bg-danger text-white blink',
      'CLOSED': 'bg-success text-white',
      'IN_PROGRESS': 'bg-primary text-white',
      'EXTENDED': 'bg-secondary text-white',
      'CANCELLED': 'bg-dark text-white'
    };
    return map[status] || 'bg-secondary text-white';
  }

  openProofsModal(request: any): void {
    this.selectedRequestProofs = request.proofs || [];
    this.proofsModal = new Modal(document.getElementById('proofsModal')!);
    this.proofsModal.show();
  }

  getFileName(url: string): string {
    if (!url) return 'Unknown file';
    return url.split('/').pop()?.split('?')[0] || 'File';
  }

  // --- REQUEST APPROVAL / REJECTION ---

  approveClosureRequest(requestId: number): void {
    if (!confirm('Are you sure you want to approve this closure request?')) return;

    this.requestService.approveRequest(this.taskId, requestId, {}).subscribe({
      next: (res) => {
        if (res.success) {
          alert('Closure request approved successfully!');
          this.reloadTask();
        } else {
          alert(res.message || 'Failed to approve closure request.');
        }
      },
      error: (error) => {
        console.error('Error approving closure request:', error);
        alert('Failed to approve closure request. Please try again.');
      }
    });
  }

  showExtensionApprovalModal(request: any): void {
    this.extensionRequestId = request.requestId;
    
    // Set default extension date to current due date + 7 days
    const currentDueDate = new Date(this.task?.dueDate || new Date());
    currentDueDate.setDate(currentDueDate.getDate() + 7);
    this.extensionDueDate = currentDueDate.toISOString().split('T')[0];
    
    this.extensionModal = new Modal(document.getElementById('extensionApprovalModal')!);
    this.extensionModal.show();
  }

  confirmExtensionApproval(): void {
    if (!this.extensionRequestId || !this.extensionDueDate) {
      alert('Please select a new due date.');
      return;
    }

    const isoDateTime = `${this.extensionDueDate}T00:00:00`;

    this.requestService.approveRequest(
      this.taskId,
      this.extensionRequestId,
      { newDueDate: isoDateTime }
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.extensionModal?.hide();
          alert('Extension approved successfully!');
          this.reloadTask();
        } else {
          alert(res.message || 'Failed to approve extension.');
        }
      },
      error: (err) => {
        console.error('Approve failed:', err);
        alert('Failed to approve extension. Please try again.');
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
    if (!this.rejectionRequestId || !this.rejectionReason?.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    this.requestService.rejectRequest(
      this.taskId,
      this.rejectionRequestId,
      this.rejectionReason.trim()
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.rejectionModal?.hide();
          alert('Request rejected successfully!');
          this.reloadTask();
        } else {
          alert(res.message || 'Failed to reject request.');
        }
      },
      error: (error) => {
        console.error('Error rejecting request:', error);
        alert('Failed to reject request. Please try again.');
      }
    });
  }

  private reloadTask(): void {
    this.loadTask(this.taskId);
  }

  approveTask(): void {
    if (!this.task?.taskId || this.isApproving) return;
    
    if (!confirm('Are you sure you want to approve this entire task?')) return;

    this.isApproving = true;
    this.taskService.approveTask(this.task.taskId).subscribe({
      next: (res) => {
        if (res.success) {
          this.task = res.data;
          alert('Task approved successfully!');
        } else {
          alert(res.message || 'Failed to approve task.');
        }
        this.isApproving = false;
      },
      error: (error) => {
        console.error('Error approving task:', error);
        alert('Failed to approve task. Please try again.');
        this.isApproving = false;
      }
    });
  }

  // --- NAVIGATION METHODS ---
  
  goBack(): void {
    this.router.navigate(['/view-tasks']);
  }

  viewDepartmentDetails(departmentId: number): void {
    this.router.navigate(['/department', departmentId]);
  }

  viewUserProfile(userId: number): void {
    this.router.navigate(['/user', userId]);
  }

  // --- UTILITY METHODS ---
  
  getRecurrenceTypeDisplay(type: string): string {
    const typeMap: Record<string, string> = {
      'DAILY': 'Daily',
      'WEEKLY': 'Weekly',
      'MONTHLY': 'Monthly',
      'YEARLY': 'Yearly',
      'CUSTOM': 'Custom'
    };
    return typeMap[type] || type;
  }

  isTaskOverdue(): boolean {
    if (!this.task?.dueDate) return false;
    
    const dueDate = new Date(this.task.dueDate);
    const today = new Date();
    return dueDate < today && this.task.status !== 'CLOSED';
  }

  getDaysRemaining(): number {
    if (!this.task?.dueDate) return 0;
    
    const dueDate = new Date(this.task.dueDate);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  // Add these methods to your ViewTask class:

// Check if a specific instance is overdue
isInstanceOverdue(instance: TaskDto): boolean {
  if (!instance?.dueDate || instance.status === 'CLOSED') return false;
  
  const dueDate = new Date(instance.dueDate);
  const today = new Date();
  
  // Clear time for accurate day comparison
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  
  return dueDate < today;
}

// Count instances by status
getInstanceCountByStatus(status: string): number {
  if (!this.recurredInstances || this.recurredInstances.length === 0) return 0;
  
  return this.recurredInstances.filter(instance => 
    instance.status === status
  ).length;
}

// Calculate days remaining for an instance
getInstanceDaysRemaining(instance: TaskDto): number {
  if (!instance?.dueDate || instance.status === 'CLOSED') return 0;
  
  const dueDate = new Date(instance.dueDate);
  const today = new Date();
  
  // Clear time for accurate day comparison
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// Get instance status badge class (similar to getStatusBadgeClass but for instances)
getInstanceStatusBadgeClass(instance: TaskDto): string {
  if (this.isInstanceOverdue(instance)) {
    return 'bg-danger text-white blink';
  }
  
  return this.getStatusBadgeClass(instance.status);
}

// Filter instances by status
getInstancesByStatus(status: string): TaskDto[] {
  if (!this.recurredInstances) return [];
  
  return this.recurredInstances.filter(instance => 
    instance.status === status
  );
}
}