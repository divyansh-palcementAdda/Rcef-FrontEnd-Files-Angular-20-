// src/app/Model/department.ts
import { userDto } from './userDto';

export interface Department {
  departmentId: number;
  name: string;
  departmentName?: string; // Alternative name field from API
  description?: string;
  departmentStatus?: 'ACTIVE' | 'INACTIVE';
  hod?: userDto;           // HOD is a User
  users?: userDto[];       // All users in department
  subDepartments?: SubDepartment[]; // Sub-departments in this department
}

export interface SubDepartment {
  subDepartmentId: string;
  name: string;
}