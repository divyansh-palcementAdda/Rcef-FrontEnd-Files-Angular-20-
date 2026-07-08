export interface SubjectDto {
  id: number;
  subjectCode: string;       // Auto-generated UUID — read-only, not shown in forms
  subjectName: string;
  description?: string;
  isActive: boolean;
  departmentId: number;
  departmentName: string;
  subDepartmentId: string;   // UUID as string
  subDepartmentName: string;
  createdById?: number;
  createdByName?: string;
  createdAt?: string;
  updatedById?: number;
  updatedByName?: string;
  updatedAt?: string;
  assignedUsers?: AssignedUserMin[];
}

export interface AssignedUserMin {
  userId: number;
  fullName: string;
  email: string;
  role: string;
  subjectAssignedAt?: string;
}

export interface SubjectRequest {
  subjectName: string;
  description?: string;
  departmentId: number;
  subDepartmentId: string;   // UUID string
  isActive?: boolean;
}

export interface SubjectAnalytics {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  departmentName: string;
  subDepartmentName: string;
  totalUsers: number;
  totalTeachers: number;
  totalHods: number;
  totalTasks: number;
  pendingTasks: number;
  upcomingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  closedTasks: number;
  delayedTasks: number;
  extendedTasks: number;
  requestForClosure: number;
  requestForExtension: number;
}

export interface SubjectDetail extends SubjectDto {
  analytics?: SubjectAnalytics;
  recentActivity?: RecentActivity[];
}

export interface RecentActivity {
  action: string;
  performedBy: string;
  timestamp: string;
  details?: string;
}
