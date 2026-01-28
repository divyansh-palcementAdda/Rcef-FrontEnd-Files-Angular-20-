export interface DashboardDto {
  recurringParentTask: any;
  recurredInstanceTask: any;
  zeroDueDepartments: any;
  myDepartmentTasks: any;
  totalTask: number;
  pendingTask: number;
  delayedTask: number;
  completedTask: number;
  upcomingTask: number;
  requestForClosure: number;
  requestForExtension: number;
  approvedRequests: number;
  rejectedRequests: number;
  pendingRequests: number;
  activeUsers?: number;         // Admin/HOD only
  totalUsers?: number;          // Admin/HOD only
  activeDepartments?: number;   // Admin only
  totalDepartments?: number;    // Admin only
  loggedInRole: string;
  departmentName?: string;
  userName?: string;
  selfTask?: number;           // User only
  activeTask?:number;
  extendedTask?: number;           // Admin/HOD only
  tasksRequireApproval?: number;           // Admin/HOD only
  email?: string;
}

