// src/app/Model/department.ts
import { userDto } from './userDto';

export interface Department {
  departmentId: number;
  name: string;
  description?: string;
  departmentStatus?: 'ACTIVE' | 'INACTIVE';
  hod?: userDto;           // HOD is a User
  users?: userDto[];       // All users in department
}