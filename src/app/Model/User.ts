export  interface User {
     id: number;
    name: string;
    email: string;
    role: string;
    fullName: string;
    status: string;
    departmentNames: string[];
    emailVerified: boolean;
    departmentIds: number[];

    parentUserId?: number;
    parentFullName?: string;
    reportingManagerIds?: number[];
    reportingManagerNames?: string[];
    subDepartmentId?: string;
    subDepartmentName?: string;
    permissions?: string[];
}