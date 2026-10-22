export interface UserRoleAssignmentDTO {
  id: number;
  userId: number;
  username?: string;
  roleId: string | number;
  roleName: string;
  roleDisplayName?: string;
  roleLevel?: number;
  departmentId?: number;
  departmentName?: string;
  subDepartmentId?: string;
  subDepartmentName?: string;
  isPrimary?: boolean;
  primary?: boolean;
  isActive?: boolean;
  active?: boolean;
  displayLabel?: string;
  createdAt?: string;
}

export interface ScopedRoleAssignment {
  id?: number;
  departmentId: number;
  departmentName?: string;
  subDepartmentId: string;
  subDepartmentName?: string;
  role: 'HOD' | 'TEACHER';
}
