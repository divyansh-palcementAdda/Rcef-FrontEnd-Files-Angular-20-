import { Injectable, inject } from '@angular/core';
import { AuthApiService } from './auth-api-service';
import { UserApiService } from './UserApiService';
import { userDto } from '../Model/userDto';

/**
 * Centralized Authorization and Dynamic RBAC Service.
 *
 * <p>Serves as the single source of truth for UI permission checks,
 * route guard validation, and structural context validation (departments,
 * sub-departments, subjects, and tasks). It eliminates hardcoded role
 * visibility checks throughout the Angular application.</p>
 */
@Injectable({
  providedIn: 'root'
})
export class AuthorizationService {
  private readonly authService = inject(AuthApiService);
  private readonly userApiService = inject(UserApiService);

  private currentUser: userDto | null = null;

  constructor() {
    // Keep local cached user profile synchronized
    this.userApiService.currentUserProfile$.subscribe(user => {
      this.currentUser = user;
    });
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return !!this.authService.getAccessToken();
  }

  /**
   * Retrieves the current authenticated user's profile.
   */
  getCurrentUser(): userDto | null {
    return this.currentUser;
  }

  /**
   * Check if user has a specific permission.
   * SUPER_ADMIN is automatically granted all permissions.
   */
  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  /**
   * Check if user has at least one of the specified permissions.
   */
  hasAnyPermission(permissions: string[]): boolean {
    if (this.authService.getCurrentRole() === 'SUPER_ADMIN') {
      return true;
    }
    return permissions.some(p => this.hasPermission(p));
  }

  /**
   * Check if user has all of the specified permissions.
   */
  hasAllPermissions(permissions: string[]): boolean {
    if (this.authService.getCurrentRole() === 'SUPER_ADMIN') {
      return true;
    }
    return permissions.every(p => this.hasPermission(p));
  }

  /**
   * Validates if the user can access department level data.
   */
  canAccessDepartment(departmentId: number): boolean {
    const role = this.authService.getCurrentRole();
    if (role === 'SUPER_ADMIN') {
      return true;
    }
    if (!this.currentUser) {
      return false;
    }
    const deptIds = this.currentUser.departmentIds || [];
    return deptIds.includes(departmentId);
  }

  /**
   * Validates if the user can access sub-department level data.
   */
  canAccessSubDepartment(subDepartmentId: string): boolean {
    const role = this.authService.getCurrentRole();
    if (role === 'SUPER_ADMIN') {
      return true;
    }
    if (!this.currentUser) {
      return false;
    }
    const subDeptIds = this.currentUser.subDepartmentIds || [];
    return subDeptIds.includes(subDepartmentId);
  }

  /**
   * Validates if the user can access subject level data.
   */
  canAccessSubject(subject: any): boolean {
    const role = this.authService.getCurrentRole();
    if (role === 'SUPER_ADMIN') {
      return true;
    }
    if (!this.currentUser) {
      return false;
    }

    // ADMIN and SUB_ADMIN can access subjects in their mapped departments
    if (role === 'ADMIN' || role === 'SUB_ADMIN') {
      const userDepts = this.currentUser.departmentIds || [];
      const subjectDeptId = subject?.departmentId || subject?.department?.departmentId;
      return subjectDeptId ? userDepts.includes(subjectDeptId) : true;
    }

    // HOD can access subjects in their mapped sub-departments
    if (role === 'HOD') {
      const userSubDepts = this.currentUser.subDepartmentIds || [];
      const subjectSubDeptId = subject?.subDepartmentId || subject?.subDepartment?.id;
      return subjectSubDeptId ? userSubDepts.includes(subjectSubDeptId) : true;
    }

    // TEACHER can only access mapped subjects
    const userSubjectIds = this.currentUser.subjectIds || [];
    const subjectId = subject?.id || subject?.subjectId;
    return userSubjectIds.includes(subjectId);
  }

  /**
   * Core hierarchical task access validation.
   * - SUPER_ADMIN: Access everything.
   * - ADMIN/SUB_ADMIN: Access tasks containing their department(s).
   * - HOD: Access tasks containing their sub-department(s).
   * - TEACHER: Access tasks assigned to them or created by them.
   */
  canAccessTask(task: any): boolean {
    if (!task) return false;
    const rawRole = this.authService.getCurrentRole();
    const role = rawRole ? rawRole.toUpperCase() : '';

    if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') {
      return true;
    }

    if (role === 'ADMIN') {
      if (!this.currentUser) return true;
      const userDepts = this.currentUser.departmentIds || [];
      if (userDepts.length === 0) return true;

      const taskDepts = task.departmentIds ||
        (task.departments ? task.departments.map((d: any) => d.departmentId || d.id) :
        (task.department ? [task.department.departmentId || task.department.id] :
        (task.departmentId ? [task.departmentId] : [])));

      if (taskDepts.length > 0) {
        return taskDepts.some((id: number) => userDepts.includes(id));
      }
      return true;
    }

    if (!this.currentUser) {
      return false;
    }

    const userId = this.currentUser.userId;

    // 2. SUB_ADMIN department checks
    if (role === 'SUB_ADMIN') {
      const userDepts = this.currentUser.departmentIds || [];
      const taskDepts = task.departmentIds ||
        (task.departments ? task.departments.map((d: any) => d.departmentId || d.id) :
        (task.department ? [task.department.departmentId || task.department.id] :
        (task.departmentId ? [task.departmentId] : [])));
      if (taskDepts.length > 0) {
        return taskDepts.some((id: number) => userDepts.includes(id));
      }
      return true;
    }

    // 3. HOD sub-department / direct assignment checks
    if (role === 'HOD') {
      const userSubDepts = this.currentUser.subDepartmentIds || [];
      const assignedIds = task.assignedToIds || (task.assignedUsers ? task.assignedUsers.map((u: any) => u.userId) : (task.assignedToId ? [task.assignedToId] : []));

      // HOD direct assignment
      if (assignedIds.includes(userId)) {
        return true;
      }

      const taskSubDepts = task.subDepartmentIds ||
        (task.subDepartments ? task.subDepartments.map((s: any) => s.id || s.subDepartmentId) :
        (task.subDepartment ? [task.subDepartment.id || task.subDepartment.subDepartmentId] :
        (task.subDepartmentId ? [task.subDepartmentId] : [])));
      if (taskSubDepts.length > 0) {
        return taskSubDepts.some((id: string) => userSubDepts.includes(id));
      }

      return true;
    }

    // 4. TEACHER assignment check
    if (role === 'TEACHER') {
      const assignedIds = task.assignedToIds || (task.assignedUsers ? task.assignedUsers.map((u: any) => u.userId) : (task.assignedToId ? [task.assignedToId] : []));
      return assignedIds.includes(userId);
    }

    return false;
  }

  /**
   * Returns true if the user can edit this task.
   */
  canEditTask(task: any): boolean {
    if (!this.hasPermission('TASK_EDIT')) return false;
    const rawRole = this.authService.getCurrentRole();
    const role = rawRole ? rawRole.toUpperCase() : '';
    if (role === 'SUB_ADMIN' || role === 'TEACHER') return false;
    return this.canAccessTask(task);
  }

  /**
   * Returns true if the user can approve/reject this task.
   */
  canApproveTask(task: any): boolean {
    if (!this.hasPermission('TASK_APPROVE')) return false;
    const rawRole = this.authService.getCurrentRole();
    const role = rawRole ? rawRole.toUpperCase() : '';
    if (role === 'SUB_ADMIN' || role === 'TEACHER') return false;
    return this.canAccessTask(task);
  }

  /**
   * Returns true if the user can delete this task according to front-end UI permissions.
   * Fine-grained creator restrictions & assignment checks are enforced by backend API.
   */
  canDeleteTask(task: any): boolean {
    if (!task) return false;
    const rawRole = this.authService.getCurrentRole();
    const role = rawRole ? rawRole.toUpperCase() : '';
    if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') return true;
    if (role === 'SUB_ADMIN' || role === 'TEACHER') return false;

    if (role === 'ADMIN') {
      return (this.hasPermission('TASK_DELETE') || this.hasPermission('SUPER_ADMIN')) && this.canAccessTask(task);
    }

    if (role === 'HOD') {
      return this.hasAnyPermission(['TASK_DELETE', 'SUB_DEPARTMENT_TASK_DELETE']) && this.canAccessTask(task);
    }

    return false;
  }

  /**
   * Returns true if the user has permission to initiate bulk task deletion operations.
   */
  canBulkDeleteTasks(): boolean {
    const rawRole = this.authService.getCurrentRole();
    const role = rawRole ? rawRole.toUpperCase() : '';
    if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') return true;
    if (role === 'SUB_ADMIN' || role === 'TEACHER') return false;

    if (role === 'ADMIN') {
      return this.hasPermission('TASK_DELETE') || this.hasPermission('SUPER_ADMIN');
    }

    if (role === 'HOD') {
      return this.hasAnyPermission(['TASK_DELETE', 'SUB_DEPARTMENT_TASK_DELETE']);
    }

    return false;
  }
}
