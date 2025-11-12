import { RoleDTO } from "./role-dto";

export interface JWTResponseDTO {
  accessToken: string;
  refreshToken: string;
  type: string;
  id: number;
  username: string;
  email: string;
  role: RoleDTO;
}
