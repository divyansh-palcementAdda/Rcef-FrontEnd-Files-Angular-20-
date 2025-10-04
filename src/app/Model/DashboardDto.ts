export interface DashboardDto {
  totalTask: number;
  pendingTask: number;
  delayedTask: number;
  completedTask: number;
  upcomingTask: number;
  requestForClosure: number;
  requestForExtension: number;
  activeUsers?: number;         // Admin/HOD only
  totalUsers?: number;          // Admin/HOD only
  activeDepartments?: number;   // Admin only
  totalDepartments?: number;    // Admin only
  loggedInRole: string;
  departmentName?: string;
  userName?: string;
  selfTasks?: number;           // User only
}

