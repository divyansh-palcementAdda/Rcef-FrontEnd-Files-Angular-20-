import { Routes } from '@angular/router';
import { LoginComponent } from './components/Auth/login/login';
import { AdminDashboard } from './components/Dashboards/admin-dashboard/admin-dashboard';
import { FacultysDashboard } from './components/Dashboards/facultys-dashboard/facultys-dashboard';
import { HodsDashboard } from './components/Dashboards/hods-dashboard/hods-dashboard';
import { About } from './components/HomeAssets/about/about';
import { Contact } from './components/HomeAssets/contact/contact';
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

export const routes: Routes = [

  { path: '', component: Home },
  { path: 'login', component: LoginComponent },
  { path: 'about', component: About },
  { path: 'contact', component: Contact },

  // 🔒 Protected route (requires JWT)
  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] } // ✅ Only these roles allowed
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
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'add-department', component: AddDepartmentComponent, canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  {
    path: 'add-user', component: AddUserComponent, canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] }
  }, {
    path: 'add-task', component: AddTaskComponent, canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'HOD'] }
  }, {
    path: 'view-tasks', component: ViewTasksComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN', 'HOD', 'TEACHER'] }
  },
  { path: 'user/:id', component: ViewUserComponent, canActivate: [AuthGuard] },
  {
    path: 'departments', component: ViewDepartmentsComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN', 'HOD'] }
  },
  { path: 'task/:id', component: ViewTask, canActivate: [AuthGuard] },

  // Wildcard route for a 404 page
  { path: '**', redirectTo: '' },




];
