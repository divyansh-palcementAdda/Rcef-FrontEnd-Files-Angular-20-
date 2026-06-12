import { Routes } from '@angular/router';
import { LoginComponent } from './components/Auth/login/login';
import { AdminDashboardComponent } from './components/Dashboards/admin-dashboard/admin-dashboard';
import { FacultysDashboard } from './components/Dashboards/facultys-dashboard/facultys-dashboard';
import { HodsDashboard } from './components/Dashboards/hods-dashboard/hods-dashboard';
import { Home } from './components/HomeAssets/home/home';
import { ViewAllUserss } from './components/Users/view-all-userss/view-all-userss';
import { AuthGuard } from './Guards/auth-guard';
import { RoleGuard } from './Guards/role-guard';
import { AddDepartmentComponent } from './components/Department/add-department/add-department';
import { AddUserComponent } from './components/Auth/add-user/add-user';
import { AddTaskComponent } from './components/Tasks/add-task/add-task';
import { ViewTasksComponent } from './components/Tasks/view-tasks/view-tasks';
import { ViewUserComponent } from './components/Users/view-user/view-user';
import { ViewDepartmentsComponent } from './components/Department/view-all-departments/view-all-departments';
import { ViewTask } from './components/Tasks/view-task/view-task';
import { UpdateTaskComponent } from './components/Tasks/update-task/update-task';
import { EditUser } from './components/Users/edit-user/edit-user';
import { GetDepartment } from './components/Department/get-deprtment/get-deprtment';
import { ViewAllRequests } from './components/Requests/view-all-requests/view-all-requests';
import { Test } from './components/Test/test/test';
import { Test2 } from './components/Test/test2/test2';
import { Test3 } from './components/Test/test3/test3';
import { CreateRecurringTaskComponent } from './components/Tasks/create-recurring-task-component/create-recurring-task-component';
import { Test4 } from './components/Test/test4/test4';
import { Test5 } from './components/Test/test5/test5';
import { RolePermissionManagementComponent } from './components/RolesPermissions/roles-permissions';
import { SubDepartmentManagementComponent } from './components/SubDepartments/sub-departments';
import { HierarchyViewerComponent } from './components/HierarchyTree/hierarchy-tree';
import { TaskTemplateManagementComponent } from './components/Tasks/task-template-management/task-template-management';

import { ModalRedirectGuard } from './Guards/modal-redirect.guard';

export const routes: Routes = [

  { path: '', component: Home },
  { path: 'test', component: Test }, //veiw tasks page on test route
  { path: 'test2/:id', component: Test2 },
  { path: 'test3', component: Test3 },
  { path: 'test5', component: Test5 },
  { path: 'test4/:id', component: Test4 },

  { path: 'login', component: LoginComponent },
  {
    path: 'createRecurring', component: CreateRecurringTaskComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { permissions: ['TASK_CREATE'] }
  },


  // 🔒 Protected route (requires JWT)
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'SUB_ADMIN', 'SUPER_ADMIN'] } // ✅ Admin-level dashboard
  },
  {
    path: 'hod',
    component: HodsDashboard,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['HOD'] }
  },
  {
    path: 'teacher',
    component: FacultysDashboard,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['TEACHER'] }
  },
  {
    path: 'viewAllUsers',
    component: ViewAllUserss,
    canActivate: [AuthGuard, RoleGuard],
    data: { permissions: ['USER_VIEW'] }
  },
  {
    path: 'add-department', component: AddDepartmentComponent, canActivate: [AuthGuard, RoleGuard, ModalRedirectGuard],
    data: { permissions: ['DEPARTMENT_CREATE'] }
  },
  {
    path: 'edit-department/:id', component: AddDepartmentComponent, canActivate: [AuthGuard, RoleGuard, ModalRedirectGuard],
    data: { permissions: ['DEPARTMENT_EDIT'] }
  },
  {
    path: 'add-user', component: AddUserComponent, canActivate: [AuthGuard, RoleGuard, ModalRedirectGuard],
    data: { permissions: ['USER_CREATE'] }
  }, {
    path: 'add-task', component: AddTaskComponent, canActivate: [AuthGuard, RoleGuard, ModalRedirectGuard],
    data: { permissions: ['TASK_CREATE'] }
  },
  {
    path: 'edit-task', component: UpdateTaskComponent, canActivate: [AuthGuard, RoleGuard, ModalRedirectGuard],
    data: { permissions: ['TASK_EDIT'] }
  }, {
    path: 'edit-user/:id', component: EditUser, canActivate: [AuthGuard, RoleGuard, ModalRedirectGuard],
    data: { permissions: ['USER_EDIT'] }
  }, {
    path: 'view-tasks', component: ViewTasksComponent,
    canActivate: [AuthGuard]
  }, {
    path: 'user/:id', component: ViewUserComponent, canActivate: [AuthGuard]
  },
  {
    path: 'departments', component: ViewDepartmentsComponent, canActivate: [AuthGuard], data: { permissions: ['DEPARTMENT_CREATE'] }
  }, {
    path: 'department/:id', component: GetDepartment, canActivate: [AuthGuard], data: { permissions: ['DEPARTMENT_CREATE'] }
  },

  { path: 'task/:id', component: ViewTask, canActivate: [AuthGuard] },
  { path: 'task-requests', component: ViewAllRequests, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['TASK_APPROVE'] } },
  { path: 'roles-permissions', component: RolePermissionManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['USER_EDIT'] } },
  { path: 'sub-departments', component: SubDepartmentManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['SUB_DEPARTMENT_CREATE'] } },
  { path: 'hierarchy-tree', component: HierarchyViewerComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['USER_VIEW'] } },
  { path: 'task-templates', component: TaskTemplateManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['TASK_CREATE'] } },

  // Wildcard route for a 404 page
  { path: '**', redirectTo: '' },
];
