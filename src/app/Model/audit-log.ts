export interface AuditLog {
  logId: number;
  userId: number;          // From user.id (joined)
  action: string;          // e.g., "USER_CREATED", "TASK_ASSIGNED"
  entity: string;          // e.g., "User", "Task", "Department"
  entityId: number;        // ID of the affected entity
  timestamp: string;       // ISO date string from LocalDateTime
  details?: string;        // Optional extra info (nullable)
}