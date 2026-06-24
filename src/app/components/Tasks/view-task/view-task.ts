import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentApiService, StudentReportingDto } from '../../../Services/student-api.service';
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
import { TaskRequestDto, StructuredProofValueDto } from '../../../Model/TaskRequestDto';
import { ConfirmDialogService } from '../../../Services/confirm-dialog.service';

interface EnrichedDepartment {
  id: number;
  name: string;
  hodName: string;
  userCount: number;
  users: userDto[];
  description?: string;
  departmentStatus?: string;
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
  isMoreActionsOpen = false;
  dynamicProofValues: { [key: string]: any } = {};
  dynamicProofFiles: { [key: string]: any } = {};
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
  activeTab: string = 'members';
  allProofs: any[] = [];
  comments: any[] = [];
  newCommentText = '';
  currentUserFullName = '';
  replyingToCommentId: string | null = null;
  replyText = '';

  get pendingRequestsCount(): number {
    return this.task?.requests?.filter(r => r.status?.toUpperCase() === 'PENDING').length || 0;
  }

  getApproverName(): string {
    if (!this.task?.requests) return '—';
    const approvedReq = this.task.requests.find(r => r.status === 'APPROVED' && r.approvedByName);
    return approvedReq ? approvedReq.approvedByName || '—' : '—';
  }

  get creatorInitials(): string {
    if (!this.task?.createdByName) return 'DT';
    const parts = this.task.createdByName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return this.task.createdByName.slice(0, 2).toUpperCase();
  }

  // Recurred Instances
  recurredInstances: TaskDto[] = [];
  selectedInstance?: TaskDto;

  selectedRequestProofs: any[] = [];
  selectedRequestStructuredProof: any = null;
  selectedRequestRemarks = '';
  selectedRequest: TaskRequestDto | null = null;
  private proofsModal?: Modal;
  private requestDetailModal?: Modal;
  private subscriptions = new Subscription();

  // Add Request Modal State
  newRequest: {
    requestType: 'CLOSURE' | 'EXTENSION' | null;
    remarks: string;
  } = { requestType: null, remarks: '' };

  selectedProofs: File[] = [];

  // Student Search and Selection
  studentSearchResults: StudentReportingDto[] = [];
  selectedStudentsList: StudentReportingDto[] = [];
  studentSearchQuery: string = '';
  studentPage: number = 0;
  studentPageSize: number = 20;
  studentsLoading: boolean = false;
  hasMoreStudents: boolean = true;
  studentSearchError: string | null = null;
  private searchDebounceTimer: any = null;
  expandedRequests: { [requestId: number]: boolean } = {};
  studentReportCounts: { [key: number]: any } = {};
  studentReportHistories: { [key: number]: any[] } = {};
  expandedStudentHistories: { [key: number]: boolean } = {};

  // Template Proof States
  studentEntriesList: { studentName: string, enrollmentId: string }[] = [{ studentName: '', enrollmentId: '' }];
  topicsList: { id: number; value: string }[] = [{ id: Date.now(), value: '' }];
  private topicIdCounter = Date.now() + 1;
  attendanceFile: File | null = null;

  addStudentEntry(): void {
    this.studentEntriesList.push({ studentName: '', enrollmentId: '' });
  }

  removeStudentEntry(index: number): void {
    if (this.studentEntriesList.length > 1) {
      this.studentEntriesList.splice(index, 1);
    } else {
      this.studentEntriesList[0] = { studentName: '', enrollmentId: '' };
    }
  }

  addTopic(): void {
    this.topicsList.push({ id: this.topicIdCounter++, value: '' });
  }

  removeTopic(index: number): void {
    if (this.topicsList.length > 1) {
      this.topicsList.splice(index, 1);
    } else {
      this.topicsList[0].value = '';
    }
  }

  trackTopicById(index: number, topic: { id: number; value: string }): number {
    return topic.id;
  }

  onAttendanceFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.attendanceFile = file;
    }
  }

  hasProofRequirement(type: string): boolean {
    return this.task?.template?.proofRequirements?.some((pr: any) => pr.proofType === type) || false;
  }

  isProofRequirementRequired(type: string): boolean {
    return this.task?.template?.proofRequirements?.find((pr: any) => pr.proofType === type)?.isRequired || false;
  }

  getProofRequirementFieldType(type: string): string {
    return this.task?.template?.proofRequirements?.find((pr: any) => pr.proofType === type)?.fieldType || 'TEXT';
  }

  get isTemplateClosureValid(): boolean {
    if (!this.task?.template || this.newRequest.requestType !== 'CLOSURE') return true;

    if (this.hasProofRequirement('STUDENT_ENTRIES') && this.isProofRequirementRequired('STUDENT_ENTRIES')) {
      const isStudentSelection = this.isStudentSelectionRequirement();
      if (isStudentSelection) {
        const targetCount = this.task?.targetCount ?? 1;
        if (this.selectedStudentsList.length < targetCount) return false;
      } else {
        const hasValidEntry = this.studentEntriesList.some(e => e.studentName?.trim() && e.enrollmentId?.trim());
        if (!hasValidEntry) return false;
      }
    }

    if (this.hasProofRequirement('ATTENDANCE_UPLOAD') && this.isProofRequirementRequired('ATTENDANCE_UPLOAD')) {
      if (!this.attendanceFile) return false;
    }

    if (this.hasProofRequirement('TOPICS_LIST') && this.isProofRequirementRequired('TOPICS_LIST')) {
      const hasValidTopic = this.topicsList.some(t => t?.value?.trim());
      if (!hasValidTopic) return false;
    }

    // Dynamic inputs required checks
    if (this.task.template.proofRequirements) {
      for (const req of this.task.template.proofRequirements) {
        const isLegacy = ['STUDENT_ENTRIES', 'ATTENDANCE_UPLOAD', 'TOPICS_LIST'].includes(req.proofType);
        if (!isLegacy && req.isRequired) {
          const key = req.proofTypeName || req.proofType;
          if (req.fieldType === 'FILE') {
            if (!this.dynamicProofFiles[key]) return false;
          } else {
            const val = this.dynamicProofValues[key];
            if (val === undefined || val === null || val === '' || (typeof val === 'string' && !val.trim())) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  // Enhanced stats with icons
  private _stats: TaskStats[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskApiService,
    private deptService: DepartmentApiService,
    private userService: UserApiService,
    private jwtService: JwtService,
    private requestService: RequestApiService,
    private studentApiService: StudentApiService,
    private confirmDialog: ConfirmDialogService
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
    if (this.currentUserRole === "TEACHER") return false;
    if (this.currentUserRole === "HOD") {
      return this.task?.createdById === this.currentUserId;
    }
    return true;
  }

  editTask(): void {
    if (this.canEditDelete()) {
      console.log("Edit task");
      this.router.navigate(['/edit-task'], {
        queryParams: { taskId: this.taskId }
      });
    }
  }

  toggleMoreActions(event: Event): void {
    event.stopPropagation();
    this.isMoreActionsOpen = !this.isMoreActionsOpen;
  }

  @HostListener('document:click', ['$event'])
  closeMoreActionsDropdown(event: Event): void {
    this.isMoreActionsOpen = false;
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
          this.currentUserFullName = user.fullName;
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
  private applyRequestFilters(): void {

    if (!this.task?.requests) return;

    this.task.requests = this.task.requests.filter(r =>
      this.canViewRequest(r)
    );
  }

  // =========================================================
  // ✅ ROLE HELPERS
  // =========================================================

  get isAdmin(): boolean {
    return this.currentUserRole === 'SUPER_ADMIN' || this.currentUserRole === 'ADMIN' || this.currentUserRole === 'SUB_ADMIN';
  }

  get isTeacher(): boolean {
    return this.currentUserRole === 'TEACHER';
  }

  get isHod(): boolean {
    return this.currentUserRole === 'HOD';
  }

  canApproveRequest(request: TaskRequestDto): boolean {

    if (!this.task || !request) return false;

    // ✅ ADMIN → full access
    if (this.isAdmin) return true;

    // ✅ HOD → strict rules
    if (this.isHod) {

      const isClosure = request.requestType === 'CLOSURE';
      // const isTaskApproved = this.task.approved === true;
      // const isCreatedByHod = this.task.createdById === this.currentUserId;
      const isRequesterTeacher = request.requestedByRole === 'TEACHER';

      return isClosure && isRequesterTeacher;
    }

    return false;
  }

  canRejectRequest(request: any): boolean {
    return this.canApproveRequest(request);
  }

  canViewRequest(request: any): boolean {

    if (this.isAdmin) return true;

    if (this.isTeacher) {
      return request.requestedById === this.currentUserId;
    }
    return true;
  }

  private verifyTeacherAccess(taskId: number): void {

    this.taskService.getTaskById(taskId).subscribe({
      next: res => {
        if (!res.success || !res.data) {
          this.errorMessage = 'Task not found';
          this.isLoading = false;
          return;
        }

        if (!res.data.assignedToIds?.includes(this.currentUserId)) {
          this.isForbidden = true;
          this.isLoading = false;
          return;
        }

        this.task = res.data;
        this.isAssigned = true;
        this.applyRequestFilters();
        this.aggregateProofs();
        this.loadComments();
        this.computeStats();
        this.fetchRelatedEntities();
        this.fetchCountsForProofStudents();
      },
      error: () => {
        this.isForbidden = true;
        this.isLoading = false;
      }
    });
  }
  private verifyHODAccess(taskId: number): void {

    this.taskService.getTaskById(taskId).subscribe({
      next: res => {

        if (!res.success || !res.data) {
          this.errorMessage = 'Task not found';
          this.isLoading = false;
          return;
        }

        const hasDeptAccess = res.data.departmentIds?.some(d =>
          this.currentUserDepartments.includes(d)
        );

        if (!hasDeptAccess) {
          this.isForbidden = true;
          this.isLoading = false;
          return;
        }

        this.task = res.data;
        this.isAssigned = res.data.assignedToIds?.includes(this.currentUserId) || false;
        this.applyRequestFilters();
        this.aggregateProofs();
        this.loadComments();
        this.computeStats();
        this.fetchRelatedEntities();
        this.fetchCountsForProofStudents();
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
          console.log('Task loaded successfully:', this.task);

          this.isAssigned = res.data.assignedToIds?.includes(this.currentUserId) || false;
          this.filterVisibleRequestsAndProofs();
          this.aggregateProofs();
          this.loadComments();
          this.computeStats();
          this.fetchRelatedEntities();
          this.fetchCountsForProofStudents();

          if (this.task.isRecurring && this.isAdmin) {
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
    const cachedInstance = this.recurredInstances.find(i => i.taskId === instanceId);

    if (cachedInstance) {
      this.selectedInstance = cachedInstance;
      this.openViewInstanceModal();
    } else {
      this.isLoading = true;
      this.taskService.getTaskById(instanceId).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.selectedInstance = res.data;
            this.openViewInstanceModal();
          } else {
            this.errorMessage = 'Failed to load instance details.';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading instance details:', error);
          this.errorMessage = 'Failed to load instance details.';
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
      console.log('Filtering requests for TEACHER:', this.currentUserId);
      console.log('Original requests:', this.task.requests);

      this.task.requests = this.task.requests.filter(r => {
        console.log('createdBy:', r.requestedById, 'currentUserId:', this.currentUserId);
        return r.requestedById === this.currentUserId;
      });
    }
    else if (this.isHOD) {
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
        users,
        description: dept.description || 'No description provided.',
        departmentStatus: dept.departmentStatus || 'ACTIVE'
      };
    });
  }

  // --- ADD REQUEST MODAL ---

  get isAssignedToCurrentUser(): boolean {
    return this.isAssigned;
  }

  openAddRequestModal(): void {
    this.newRequest = { requestType: 'CLOSURE', remarks: '' };
    this.selectedProofs = [];
    this.studentEntriesList = [{ studentName: '', enrollmentId: '' }];
    this.topicsList = [{ id: Date.now(), value: '' }];
    this.topicIdCounter = Date.now() + 1;
    this.attendanceFile = null;
    this.dynamicProofValues = {};
    this.dynamicProofFiles = {};

    // Reset Student Selection state
    this.selectedStudentsList = [];
    this.studentSearchQuery = '';
    this.studentPage = 0;
    this.studentSearchResults = [];
    this.hasMoreStudents = true;
    this.studentSearchError = null;

    this.addRequestModal = new Modal(document.getElementById('addRequestModal')!);
    this.addRequestModal.show();

    // Fetch initial list of students if template is STUDENT_SELECTION
    if (this.isStudentSelectionRequirement()) {
      this.loadStudents(true);
    }
  }

  loadStudents(reset: boolean = false): void {
    if (this.studentsLoading) return;
    if (reset) {
      this.studentPage = 0;
      this.studentSearchResults = [];
      this.hasMoreStudents = true;
      this.studentSearchError = null;
    }
    if (!this.hasMoreStudents) return;

    this.studentsLoading = true;
    this.studentApiService.getStudents(this.studentSearchQuery, this.studentPage, this.studentPageSize).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          if (res.data.length < this.studentPageSize) {
            this.hasMoreStudents = false;
          }
          this.studentSearchResults = [...this.studentSearchResults, ...res.data];
          this.studentPage++;

          const userIds = res.data.map(s => s.userId).filter(id => id !== undefined && id !== null);
          if (userIds.length > 0) {
            this.studentApiService.getStudentCounts(userIds).subscribe({
              next: (counts) => {
                if (counts) {
                  counts.forEach(c => {
                    this.studentReportCounts[c.studentUserId] = c;
                  });
                }
              },
              error: (err) => console.error('Error fetching student report counts:', err)
            });
          }
        } else {
          this.studentSearchError = res.message || 'Failed to fetch students';
        }
        this.studentsLoading = false;
      },
      error: (err) => {
        console.error('Error fetching students:', err);
        this.studentSearchError = 'Network error. Please try again.';
        this.studentsLoading = false;
      }
    });
  }

  onStudentSearchInput(event: any): void {
    const query = event.target.value;
    this.studentSearchQuery = query;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.loadStudents(true);
    }, 300);
  }

  onStudentListScroll(event: any): void {
    const el = event.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      if (this.hasMoreStudents && !this.studentsLoading) {
        this.loadStudents();
      }
    }
  }

  toggleStudentSelection(student: StudentReportingDto): void {
    const idx = this.selectedStudentsList.findIndex(s => s.userId === student.userId || s.enrollmentId === student.enrollmentId);
    if (idx > -1) {
      this.selectedStudentsList.splice(idx, 1);
    } else {
      this.selectedStudentsList.push(student);
    }
    this.syncSelectedStudentsToEntries();
  }

  isStudentSelected(student: StudentReportingDto): boolean {
    return this.selectedStudentsList.some(s => s.userId === student.userId || s.enrollmentId === student.enrollmentId);
  }

  clearAllSelectedStudents(): void {
    this.selectedStudentsList = [];
    this.syncSelectedStudentsToEntries();
  }

  syncSelectedStudentsToEntries(): void {
    this.studentEntriesList = this.selectedStudentsList.map(s => ({
      studentName: s.studentName,
      enrollmentId: s.enrollmentId,
      userId: s.userId,
      course: s.course
    }));
  }

  isStudentSelection(fieldType: string | undefined): boolean {
    return fieldType === 'STUDENT_SELECTION';
  }

  isStudentSelectionRequirement(): boolean {
    if (!this.task?.template?.proofRequirements) return false;
    return this.task.template.proofRequirements.some((pr: any) =>
      pr.fieldType === 'STUDENT_SELECTION' ||
      pr.proofType === 'STUDENT_ENTRIES' ||
      pr.proofTypeName === 'Student Entries'
    );
  }

  isStudentSelectionProof(p: StructuredProofValueDto): boolean {
    if (!p) return false;
    return p.fieldType === 'STUDENT_SELECTION' ||
           p.proofTypeName === 'Student Entries' ||
           p.proofTypeName === 'STUDENT_ENTRIES';
  }

  parseStudentSelection(value: string | undefined): any[] {
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('Failed to parse student selection JSON:', e);
      return [{ studentName: value, enrollmentId: '', course: '' }];
    }
  }

  toggleRequestExpansion(requestId: number): void {
    this.expandedRequests[requestId] = !this.expandedRequests[requestId];
  }

  isRequestExpanded(requestId: number): boolean {
    return !!this.expandedRequests[requestId];
  }

  onProofsSelected(event: any): void {
    const files: FileList = event.target.files;
    const maxSize = 10 * 1024 * 1024; // 10MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        this.errorMessage = `File "${file.name}" exceeds 10MB limit.`;
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
    if (this.isAddingReq) {
      return;
    }
    // Validation
    if (!this.newRequest.requestType) {
      this.errorMessage = 'Please select request type.';
      return;
    }

    if (this.newRequest.requestType === 'EXTENSION' && !this.newRequest.remarks?.trim()) {
      this.errorMessage = 'Reason is required for extension.';
      return;
    }

    // Dynamic Validation for Template tasks closure
    if (this.newRequest.requestType === 'CLOSURE') {
      if (this.task?.template) {
        if (this.hasProofRequirement('STUDENT_ENTRIES') && this.isProofRequirementRequired('STUDENT_ENTRIES')) {
          const isStudentSelection = this.isStudentSelectionRequirement();
          if (isStudentSelection) {
            const targetCount = this.task?.targetCount ?? 1;
            if (this.selectedStudentsList.length < targetCount) {
              this.errorMessage = `At least ${targetCount} student entries are required.`;
              return;
            }
          } else {
            const validEntries = this.studentEntriesList.filter(e => e.studentName?.trim() && e.enrollmentId?.trim());
            if (validEntries.length === 0) {
              this.errorMessage = 'At least one student entry (Name and Enrollment ID) is required.';
              return;
            }
          }
        }
        if (this.hasProofRequirement('ATTENDANCE_UPLOAD') && this.isProofRequirementRequired('ATTENDANCE_UPLOAD')) {
          if (!this.attendanceFile) {
            this.errorMessage = 'Attendance sheet file (Excel/CSV) is required.';
            return;
          }
        }
        if (this.hasProofRequirement('TOPICS_LIST') && this.isProofRequirementRequired('TOPICS_LIST')) {
          const validTopics = this.topicsList.filter(t => t?.value?.trim());
          if (validTopics.length === 0) {
            this.errorMessage = 'At least one topic covered is required.';
            return;
          }
        }

        // Dynamic inputs validations
        if (this.task.template.proofRequirements) {
          for (const req of this.task.template.proofRequirements) {
            const isLegacy = ['STUDENT_ENTRIES', 'ATTENDANCE_UPLOAD', 'TOPICS_LIST'].includes(req.proofType);
            if (!isLegacy) {
              const val = this.dynamicProofValues[req.proofTypeName || req.proofType];
              if (req.isRequired) {
                if (req.fieldType === 'FILE') {
                  if (!this.dynamicProofFiles[req.proofTypeName || req.proofType]) {
                    this.errorMessage = `Proof requirement "${req.proofTypeName || req.proofType}" is required.`;
                    return;
                  }
                } else if (val === undefined || val === null || val === '' || (typeof val === 'string' && !val.trim())) {
                  this.errorMessage = `Proof requirement "${req.proofTypeName || req.proofType}" is required.`;
                  return;
                }
              }
            }
          }
        }
      } else {
        // Legacy: general tasks closure requires at least one general proof file
        if (this.selectedProofs.length === 0) {
          this.errorMessage = 'At least one proof file is required for closure.';
          return;
        }
      }
    }

    this.isAddingReq = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('requestType', this.newRequest.requestType);

    if (this.newRequest.remarks?.trim()) {
      formData.append('remarks', this.newRequest.remarks.trim());
    }

    // Append legacy general proofs if any
    this.selectedProofs.forEach(file => {
      formData.append('proofs', file, file.name);
    });

    // Append template-specific proofs
    if (this.newRequest.requestType === 'CLOSURE' && this.task?.template) {
      // Serialize dynamic proof inputs
      const customFieldsObj = { ...this.dynamicProofValues };
      formData.append('customFields', JSON.stringify(customFieldsObj));

      // Append dynamic proof files
      for (const key of Object.keys(this.dynamicProofFiles)) {
        const file = this.dynamicProofFiles[key];
        formData.append('proofs', file, file.name);
      }

      if (this.hasProofRequirement('STUDENT_ENTRIES')) {
        const isStudentSelection = this.isStudentSelectionRequirement();
        if (isStudentSelection) {
          formData.append('studentEntries', JSON.stringify(this.studentEntriesList));
        } else {
          const validEntries = this.studentEntriesList.filter(e => e.studentName?.trim() && e.enrollmentId?.trim());
          formData.append('studentEntries', JSON.stringify(validEntries));
        }
      }

      if (this.hasProofRequirement('ATTENDANCE_UPLOAD') && this.attendanceFile) {
        formData.append('attendanceFile', this.attendanceFile, this.attendanceFile.name);
      }

      if (this.hasProofRequirement('TOPICS_LIST')) {
        const validTopics = this.topicsList.filter(t => t?.value?.trim());
        validTopics.forEach(topic => {
          formData.append('topicsCovered', topic.value.trim());
        });
      }
    }

    this.requestService.createRequestWithProofs(this.taskId, formData).pipe(
      finalize(() => this.isAddingReq = false)
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.addRequestModal?.hide();
          this.reloadTask();
        } else {
          this.errorMessage = res.message || 'Failed to submit request.';
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Server error. Please try again.';
        console.error('Error adding request:', err);
      }
    });
  }

  startTask(): void {
    this.confirmDialog.confirm({
      title: 'Start Task',
      message: 'Are you sure you want to start this task?',
      confirmText: 'Start',
      cancelText: 'Cancel',
      type: 'info'
    }).then(confirmed => {
      if (!confirmed) return;

      this.isStarting = true;
      this.taskService.startTask(this.taskId).pipe(
        finalize(() => this.isStarting = false)
      ).subscribe({
        next: (res) => {
          if (res.success) {
            this.reloadTask();
          } else {
            this.errorMessage = res.message || 'Failed to start task.';
          }
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Server error. Please try again.';
          console.error('Error starting task:', err);
        }
      });
    });
  }

  // --- UI HELPERS ---

  toggleCollapse(section: 'users' | 'departments' | 'requests' | 'instances') {
    this.collapsed[section] = !this.collapsed[section];

    // Auto-load instances when section is opened
    if (section === 'instances' && !this.collapsed.instances &&
      this.task?.isRecurring && this.isAdmin &&
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
        count: this.allProofs.length,
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
    this.selectedRequestStructuredProof = request.structuredProof || null;
    this.selectedRequestRemarks = request.remarks || '';
    this.proofsModal = new Modal(document.getElementById('proofsModal')!);
    this.proofsModal.show();
  }

  openRequestDetailModal(request: TaskRequestDto): void {
    this.selectedRequest = request;
    this.requestDetailModal = new Modal(document.getElementById('requestDetailModal')!);
    this.requestDetailModal.show();
  }

  approveFromModal(requestId: number): void {
    this.confirmDialog.confirm({
      title: 'Approve Closure Request',
      message: 'Are you sure you want to approve this closure request?',
      confirmText: 'Approve',
      cancelText: 'Cancel',
      type: 'info'
    }).then(confirmed => {
      if (!confirmed) return;
      this.requestDetailModal?.hide();
      this.requestService.approveRequest(this.taskId, requestId, {}).subscribe({
        next: (res) => {
          if (res.success) {
            this.reloadTask();
          } else {
            this.errorMessage = res.message || 'Failed to approve closure request.';
          }
        },
        error: () => {
          this.errorMessage = 'Failed to approve closure request. Please try again.';
        }
      });
    });
  }

  approveExtensionFromModal(request: any): void {
    this.requestDetailModal?.hide();
    this.showExtensionApprovalModal(request);
  }

  rejectFromModal(request: any): void {
    this.requestDetailModal?.hide();
    this.showRejectionModal(request);
  }

  getFileName(url: string): string {
    if (!url) return 'Unknown file';
    return url.split('/').pop()?.split('?')[0] || 'File';
  }

  onDynamicFileSelected(event: any, key: string): void {
    const file = event.target.files[0];
    if (file) {
      this.dynamicProofFiles[key] = file;
      this.dynamicProofValues[key] = file.name;
    }
  }

  getCustomFieldsList(customFieldsJson: string | undefined): { key: string, value: any, isFile?: boolean }[] {
    if (!customFieldsJson) return [];
    try {
      const parsed = JSON.parse(customFieldsJson);
      const list: { key: string, value: any, isFile?: boolean }[] = [];
      for (const k of Object.keys(parsed)) {
        list.push({
          key: k,
          value: parsed[k],
          isFile: this.isFieldTypeOfFile(k, parsed[k])
        });
      }
      return list;
    } catch (e) {
      console.error('Failed to parse custom fields JSON', e);
      return [];
    }
  }

  isFieldTypeOfFile(fieldName: string, value: any): boolean {
    if (typeof value !== 'string') return false;
    const ext = value.split('.').pop()?.toLowerCase();
    if (ext && ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls', 'csv', 'doc', 'docx', 'txt'].includes(ext)) {
      return true;
    }
    const pr = this.task?.template?.proofRequirements?.find((r: any) => r.proofTypeName === fieldName || r.proofType === fieldName);
    if (pr && pr.fieldType === 'FILE') {
      return true;
    }
    return false;
  }

  getProofFileUrl(filename: string, proofs: any[] | undefined): string | null {
    if (!proofs || !filename) return null;
    const found = proofs.find(p => p.remarks === filename || (p.fileUrl && p.fileUrl.split('/').pop()?.split('?')[0] === filename));
    return found ? found.fileUrl : null;
  }

  // --- REQUEST APPROVAL / REJECTION ---

  approveClosureRequest(requestId: number): void {
    this.confirmDialog.confirm({
      title: 'Approve Closure Request',
      message: 'Are you sure you want to approve this closure request?',
      confirmText: 'Approve',
      cancelText: 'Cancel',
      type: 'info'
    }).then(confirmed => {
      if (!confirmed) return;
      this.requestService.approveRequest(this.taskId, requestId, {}).subscribe({
        next: (res) => {
          if (res.success) {
            this.reloadTask();
          } else {
            this.errorMessage = res.message || 'Failed to approve closure request.';
          }
        },
        error: (error) => {
          console.error('Error approving closure request:', error);
          this.errorMessage = 'Failed to approve closure request. Please try again.';
        }
      });
    });
  }

  showExtensionApprovalModal(request: any): void {
    if (!this.isAdmin) {
      this.errorMessage = 'Only Admin can approve extension.';
      return;
    }

    this.extensionRequestId = request.requestId;
    this.extensionDueDate = this.todayDate;

    this.extensionModal = new Modal(document.getElementById('extensionApprovalModal')!);
    this.extensionModal.show();
  }

  confirmExtensionApproval(): void {
    if (!this.extensionRequestId || !this.extensionDueDate) {
      this.errorMessage = 'Please select a new due date.';
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
          this.reloadTask();
        } else {
          this.errorMessage = res.message || 'Failed to approve extension.';
        }
      },
      error: (err) => {
        console.error('Approve failed:', err);
        this.errorMessage = 'Failed to approve extension. Please try again.';
      }
    });
  }

  showRejectionModal(request: any): void {
    if (!this.canRejectRequest(request)) {
      this.errorMessage = 'You are not allowed to reject this request.';
      return;
    }

    this.rejectionRequestId = request.requestId;
    this.rejectionReason = '';

    this.rejectionModal = new Modal(document.getElementById('rejectionModal')!);
    this.rejectionModal.show();
  }

  confirmRejection(): void {
    if (!this.rejectionRequestId || !this.rejectionReason?.trim()) {
      this.errorMessage = 'Please provide a rejection reason.';
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
          this.reloadTask();
        } else {
          this.errorMessage = res.message || 'Failed to reject request.';
          this.reloadTask();
        }
      },
      error: (error) => {
        console.error('Error rejecting request:', error);
        this.errorMessage = 'Failed to reject request. Please try again.';
        this.reloadTask();
      }
    });
  }

  reloadTask(): void {
    this.loadTask(this.taskId);
  }

  approveTask(): void {
    if (!this.task?.taskId || this.isApproving) return;

    this.confirmDialog.confirm({
      title: 'Approve Task',
      message: 'Are you sure you want to approve this entire task?',
      confirmText: 'Approve',
      cancelText: 'Cancel',
      type: 'info'
    }).then(confirmed => {
      if (!confirmed) return;

      this.isApproving = true;
      this.taskService.approveTask(this.task!.taskId!).subscribe({
        next: (res) => {
          if (res.success) {
            this.task = res.data;
          } else {
            this.errorMessage = res.message || 'Failed to approve task.';
          }
          this.isApproving = false;
        },
        error: (error) => {
          console.error('Error approving task:', error);
          this.errorMessage = 'Failed to approve task. Please try again.';
          this.isApproving = false;
        }
      });
    });
  }

  // --- NAVIGATION METHODS ---

  goBack(): void {
    this.router.navigate(['/view-tasks']);
  }

  scrollToTabs(): void {
    setTimeout(() => {
      const el = document.getElementById('workspaceTabsCard');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
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

  formatProofType(type: string): string {
    if (!type) return '';
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getExpectedOutputsDisplay(): string {
    if (!this.task?.template?.proofRequirements?.length) {
      return 'Custom';
    }
    return this.task.template.proofRequirements
      .map((pr: any) => this.formatProofType(pr.proofType))
      .join(', ');
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

  // --- PROOFS AGGREGATION ---

  aggregateProofs(): void {
    this.allProofs = [];
    if (this.task?.requests) {
      this.task.requests.forEach(req => {
        if (req.proofs) {
          req.proofs.forEach(proof => {
            this.allProofs.push({
              ...proof,
              requestType: req.requestType,
              requestId: req.requestId
            });
          });
        }
      });
    }
  }

  // --- COMMENTS MANAGEMENT ---

  loadComments(): void {
    const key = `task_comments_${this.taskId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        this.comments = JSON.parse(stored);
        this.comments.forEach(c => {
          if (!c.replies) c.replies = [];
        });
      } catch (e) {
        console.error('Failed to parse comments', e);
        this.comments = [];
      }
    } else {
      this.comments = [];
    }
  }

  addComment(): void {
    if (!this.newCommentText?.trim()) return;

    const initials = this.currentUserFullName
      ? this.currentUserFullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : 'U';

    const newComment = {
      id: Math.random().toString(36).substring(2, 9),
      taskId: this.taskId,
      userId: this.currentUserId,
      userName: this.currentUserFullName || 'Unknown User',
      userRole: this.currentUserRole || 'User',
      avatarInitials: initials,
      text: this.newCommentText.trim(),
      timestamp: new Date().toISOString(),
      replies: []
    };

    this.comments.push(newComment);
    localStorage.setItem(`task_comments_${this.taskId}`, JSON.stringify(this.comments));
    this.newCommentText = '';
  }

  toggleReplyInput(commentId: string): void {
    if (this.replyingToCommentId === commentId) {
      this.replyingToCommentId = null;
      this.replyText = '';
    } else {
      this.replyingToCommentId = commentId;
      this.replyText = '';
    }
  }

  addReply(parentComment: any): void {
    if (!this.replyText?.trim()) return;

    const initials = this.currentUserFullName
      ? this.currentUserFullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : 'U';

    const newReply = {
      id: Math.random().toString(36).substring(2, 9),
      taskId: this.taskId,
      userId: this.currentUserId,
      userName: this.currentUserFullName || 'Unknown User',
      userRole: this.currentUserRole || 'User',
      avatarInitials: initials,
      text: this.replyText.trim(),
      timestamp: new Date().toISOString()
    };

    if (!parentComment.replies) {
      parentComment.replies = [];
    }
    parentComment.replies.push(newReply);

    localStorage.setItem(`task_comments_${this.taskId}`, JSON.stringify(this.comments));
    this.replyText = '';
    this.replyingToCommentId = null;
  }

  getCommentAvatarClass(role: string): string {
    if (role === 'TEACHER') return 'avatar-grey';
    return '';
  }

  getTimelineEvents() {
    const events: any[] = [];
    if (!this.task) return events;

    // 1. Task Created
    if (this.task.startDate) {
      events.push({
        title: 'Task Created',
        date: this.task.startDate,
        type: 'created',
        icon: 'bi-plus-circle-fill',
        badgeClass: 'bg-light-green text-green',
        details: `Task was created.`,
        user: this.task.createdByName || 'System'
      });
    }

    // 2. Task Started
    if (this.task.startedAt) {
      events.push({
        title: 'Task Started',
        date: this.task.startedAt,
        type: 'started',
        icon: 'bi-play-circle-fill',
        badgeClass: 'bg-light-blue text-blue',
        details: 'Task execution was started.',
        user: this.task.startedByName || 'System'
      });
    }

    // 3. Requests: Extension, Closure
    if (this.task.requests) {
      this.task.requests.forEach(req => {
        const typeLabel = req.requestType === 'EXTENSION' ? 'Extension' : 'Closure';
        const isExtension = req.requestType === 'EXTENSION';

        // Submission Event
        events.push({
          title: `${typeLabel} Request Submitted`,
          date: req.requestDate,
          type: 'request_submitted',
          icon: isExtension ? 'bi-calendar-plus-fill' : 'bi-check-circle-fill',
          badgeClass: isExtension ? 'bg-light-purple text-purple' : 'bg-light-yellow text-yellow',
          details: req.remarks ? `Remarks: "${req.remarks}"` : `Submitted ${typeLabel.toLowerCase()} request.`,
          user: req.requestedByName || 'User'
        });

        // Resolve Event (if approved/rejected)
        if (req.status !== 'PENDING') {
          const statusLabel = req.status === 'APPROVED' ? 'Approved' : 'Rejected';
          const resolveDate = req.status === 'APPROVED' && req.requestType === 'CLOSURE' && this.task?.rfcCompletedAt ? this.task.rfcCompletedAt : req.requestDate;
          events.push({
            title: `${typeLabel} Request ${statusLabel}`,
            date: resolveDate,
            type: 'request_resolved',
            icon: req.status === 'APPROVED' ? 'bi-check-all' : 'bi-x-circle-fill',
            badgeClass: req.status === 'APPROVED' ? 'bg-light-success text-success' : 'bg-light-danger text-danger',
            details: req.status === 'REJECTED' ? 'Request was rejected.' : `Request was approved.`,
            user: req.approvedByName || 'System'
          });
        }
      });
    }

    // 4. RFC Completed
    if (this.task.rfcCompletedAt) {
      events.push({
        title: 'Task Closed (RFC Completed)',
        date: this.task.rfcCompletedAt,
        type: 'completed',
        icon: 'bi-patch-check-fill',
        badgeClass: 'bg-light-success text-success',
        details: 'The task has been marked as completed and closed.',
        user: 'System'
      });
    }

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  getGroupedStructuredProofs(structuredProofs: any[] | undefined): { name: string, values: string[] }[] {
    if (!structuredProofs || structuredProofs.length === 0) return [];
    const map = new Map<string, string[]>();
    structuredProofs.forEach(p => {
      const name = p.proofTypeName || 'Input';
      if (!map.has(name)) {
        map.set(name, []);
      }
      if (p.value) {
        map.get(name)!.push(p.value);
      }
    });
    return Array.from(map.entries()).map(([name, values]) => ({ name, values }));
  }

  hasAnyStructuredProofs(): boolean {
    return this.task?.requests?.some(r => r.structuredProofs && r.structuredProofs.length > 0) || false;
  }

  fetchCountsForProofStudents(): void {
    const studentUserIds: number[] = [];
    if (this.task?.requests) {
      this.task.requests.forEach(r => {
        if (r.structuredProof?.studentEntries) {
          r.structuredProof.studentEntries.forEach((s: any) => {
            if (s.userId && !studentUserIds.includes(s.userId)) {
              studentUserIds.push(s.userId);
            }
          });
        }
        if (r.structuredProofs) {
          r.structuredProofs.forEach(p => {
            if (this.isStudentSelectionProof(p)) {
              const students = this.parseStudentSelection(p.value);
              students.forEach((s: any) => {
                if (s.userId && !studentUserIds.includes(s.userId)) {
                  studentUserIds.push(s.userId);
                }
              });
            }
          });
        }
      });
    }
    if (studentUserIds.length > 0) {
      this.studentApiService.getStudentCounts(studentUserIds).subscribe({
        next: (counts) => {
          if (counts) {
            counts.forEach(c => {
              this.studentReportCounts[c.studentUserId] = c;
            });
          }
        },
        error: (err) => console.error('Error fetching student report counts:', err)
      });
    }
  }

  getStudentReportCounts(student: any): any {
    if (!student) return null;
    const userId = student.userId || student.studentUserId;
    if (!userId) return null;
    return this.studentReportCounts[userId];
  }

  isReportHistoryExpanded(student: any): boolean {
    if (!student) return false;
    const userId = student.userId || student.studentUserId;
    return !!this.expandedStudentHistories[userId];
  }

  toggleReportHistory(student: any, event: Event): void {
    event.stopPropagation();
    const userId = student.userId || student.studentUserId;
    if (!userId) return;
    this.expandedStudentHistories[userId] = !this.expandedStudentHistories[userId];
    if (this.expandedStudentHistories[userId] && !this.studentReportHistories[userId]) {
      this.studentApiService.getStudentReportDetails(userId).subscribe({
        next: (res) => {
          this.studentReportHistories[userId] = res.reports || [];
        },
        error: (err) => {
          console.error('Error fetching student report details:', err);
        }
      });
    }
  }

  getStudentReportHistory(student: any): any[] | null {
    if (!student) return null;
    const userId = student.userId || student.studentUserId;
    return this.studentReportHistories[userId] || null;
  }
}


