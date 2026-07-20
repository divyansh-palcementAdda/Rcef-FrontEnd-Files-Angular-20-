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
import { SubDepartmentDetailsComponent } from './components/SubDepartments/sub-department-details/sub-department-details';
import { ViewAllSubDepartmentsComponent } from './components/SubDepartments/view-all-sub-departments/view-all-sub-departments';
import { HierarchyViewerComponent } from './components/HierarchyTree/hierarchy-tree';
import { TaskTemplateManagementComponent } from './components/Tasks/task-template-management/task-template-management';
import { ViewTemplateTaskComponent } from './components/Tasks/view-task-template/view-template-task.component';
import { SubjectManagementComponent } from './components/Subjects/subject-management/subject-management';
import { SubjectDetailComponent } from './components/Subjects/subject-detail/subject-detail';
import { UsersImportComponent } from './components/Users/users-import/users-import';
import { TasksImportComponent } from './components/Tasks/tasks-import/tasks-import';
import { ModalRedirectGuard } from './Guards/modal-redirect.guard';
import { AccessDeniedComponent } from './components/Shared/access-denied/access-denied';
import { AllWorkComponent } from './components/AllWork/all-work.component';


import { UserTaskAnalyticsComponent } from './components/UserTaskAnalytics/user-task-analytics.component';

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
    data: { roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] } // ✅ Admin/Sub-Admin/Super-Admin dashboard
  },
  {
    path: 'hod',
    component: HodsDashboard,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['HOD'] } // ✅ HOD-level dashboard
  },
  {
    path: 'teacher',
    component: FacultysDashboard,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['TEACHER'] } // ✅ Teacher-level dashboard
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
    path: 'departments', component: ViewDepartmentsComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['DEPARTMENT_VIEW'] }
  }, {
    path: 'department/:id', component: GetDepartment, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['DEPARTMENT_VIEW'] }
  },

  { path: 'task/:id', component: ViewTask, canActivate: [AuthGuard] },
  { path: 'task-requests', component: ViewAllRequests, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['TASK_REQUEST_VIEW_SELF', 'TASK_REQUEST_VIEW_DEPARTMENT', 'TASK_APPROVE', 'TASK_VIEW'] } },
  { path: 'roles-permissions', component: RolePermissionManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['USER_EDIT'] } },
  { path: 'sub-departments', component: SubDepartmentManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['SUB_DEPARTMENT_CREATE'] } },
  { path: 'view-all-sub-departments', component: ViewAllSubDepartmentsComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['SUB_DEPARTMENT_CREATE'] } },
  { path: 'sub-department-details/:id', component: SubDepartmentDetailsComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['SUB_DEPARTMENT_CREATE'] } },
  { path: 'hierarchy-tree', component: HierarchyViewerComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['USER_VIEW'] } },
  { path: 'task-templates', component: TaskTemplateManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['TASK_CREATE'] } },
  {
  path: 'view-template-task/:id',
  component: ViewTemplateTaskComponent,
  canActivate: [AuthGuard]
},
  { path: 'subjects', component: SubjectManagementComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['SUBJECT_VIEW'] } },
  { path: 'subject/:id', component: SubjectDetailComponent, canActivate: [AuthGuard] },
  { path: 'users/import', component: UsersImportComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['USER_CREATE'] } },
  { path: 'tasks/import', component: TasksImportComponent, canActivate: [AuthGuard, RoleGuard], data: { permissions: ['TASK_CREATE'] } },
  {
    path: 'all-work',
    component: AllWorkComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { permissions: ['WORK_VIEW'] }
  },
  {
    path: 'user-task-analytics',
    component: UserTaskAnalyticsComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { permissions: ['WORK_ANALYTICS_VIEW', 'WORK_VIEW', 'USER_VIEW'] }
  },

  { path: 'access-denied', component: AccessDeniedComponent },

  // Wildcard route for a 404 page
  { path: '**', redirectTo: '' },
];

