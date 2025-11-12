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
}