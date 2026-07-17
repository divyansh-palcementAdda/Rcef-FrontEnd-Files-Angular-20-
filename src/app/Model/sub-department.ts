export interface SubDepartmentResponse {
  id: string;
  name: string;
  code: string;
  description: string;
  department: {
    departmentId: number;
    name: string;
    description?: string;
    departmentStatus?: 'ACTIVE' | 'INACTIVE';
  };
}
