// src/app/Model/department.ts
import { userDto } from './userDto';

export interface Department {
  id?: number;             // API response uses 'id'
  departmentId: number;    // Required - will be mapped from 'id' by service
  name: string;
  departmentName?: string; // Alternative name field from API
  code?: string;           // API response includes 'code'
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE'; // API response uses 'status'
  departmentStatus?: 'ACTIVE' | 'INACTIVE';
  hod?: userDto;           // HOD is a User
  users?: userDto[];       // All users in department
  subDepartments?: SubDepartment[]; // Sub-departments in this department
  statistics?: any;        // Statistics from API response
}

export interface SubDepartment {
  subDepartmentId: string;
  name: string;
}