import { RoleDTO } from "./role-dto";

export interface JWTResponseDTO {
    token: string;
  type: string;
  id: number;
  username: string;
  email: string;
  role: RoleDTO;
}
