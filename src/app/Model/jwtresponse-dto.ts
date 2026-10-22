import { RoleDTO } from "./role-dto";
import { UserRoleAssignmentDTO } from "./user-role-assignment-dto";

export interface JWTResponseDTO {
  accessToken: string;
  refreshToken: string;
  type: string;
  id: number;
  username: string;
  email: string;
  role: RoleDTO;
  primaryRole?: string;
  activeAssignment?: UserRoleAssignmentDTO;
  availableAssignments?: UserRoleAssignmentDTO[];
  permissions?: string[];
}
