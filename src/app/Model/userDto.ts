export interface userDto {
  userId: number;          // maps to backend userId
  username: string;        // maps to backend username
  email: string;           // maps to backend email
  fullName: string;        // maps to backend fullName
  role: string;            // maps to backend role (can be enum string)
  status: string;          // maps to backend status (active/inactive)
  departmentId: number;    // maps to backend departmentId
  departmentName: string;  // maps to backend departmentName
  emailVerified: boolean;  // maps to backend emailVerified

  // Task counters
  pendingTasks: number;    // count of pending tasks
  upcomingTasks: number;   // count of upcoming tasks
  delayedTasks: number;    // count of delayed tasks
  closedTasks: number;     // count of closed tasks
}
