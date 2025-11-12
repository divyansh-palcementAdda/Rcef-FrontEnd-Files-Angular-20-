import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../../Services/task-api-Service';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { userDto } from '../../../Model/userDto';
import { TaskDto } from '../../../Model/TaskDto';
import { TaskStatus } from '../../../Model/TaskStatus';
import { Department } from '../../../Model/department';

interface Stat { label: string; count: number; color: string; }

@Component({
  selector: 'app-get-department',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './get-deprtment.html',
  styleUrl: './get-deprtment.css'
})
export class GetDepartment implements OnInit {

  departmentId!: number;
  department!: Department;
  allDeptTasks: TaskDto[] = [];
  hodUser!: userDto | null;
  userCount = 0;
  taskCount=0;

  loading = true;
  loadingTasks = false;
  errorMessage: string | null = null;
  collapsed = { tasks: true, users: true };

  taskSearch = '';
  taskStatusFilter = '';
  taskPage = 1;
  taskPageSize = 8;
  taskFiltered: TaskDto[] = [];
  get taskPaginated() {
    const s = (this.taskPage - 1) * this.taskPageSize;
    return this.taskFiltered.slice(s, s + this.taskPageSize);
  }
  get taskTotalPages() { return Math.ceil(this.taskFiltered.length / this.taskPageSize) || 1; }

  userSearch = '';
  userPage = 1;
  userPageSize = 8;
  userFiltered: userDto[] = [];
  get userPaginated() {
    const s = (this.userPage - 1) * this.userPageSize;
    return this.userFiltered.slice(s, s + this.userPageSize);
  }
  get userTotalPages() { return Math.ceil(this.userFiltered.length / this.userPageSize) || 1; }

  get deptTaskStats(): Stat[] {
    const counts = { PENDING: 0, UPCOMING: 0, DELAYED: 0, CLOSED: 0 };
    this.allDeptTasks.forEach(t => {
      if (t.status === TaskStatus.PENDING) counts.PENDING++;
      else if (t.status === TaskStatus.UPCOMING) counts.UPCOMING++;
      else if (t.status === TaskStatus.DELAYED) counts.DELAYED++;
      else if (t.status === TaskStatus.CLOSED) counts.CLOSED++;
    });
    return [
      { label: 'Pending', count: counts.PENDING, color: 'warning' },
      { label: 'Upcoming', count: counts.UPCOMING, color: 'info' },
      { label: 'Delayed', count: counts.DELAYED, color: 'danger' },
      { label: 'Closed', count: counts.CLOSED, color: 'success' }
    ];
  }

  TaskStatus = TaskStatus;

  constructor(
    private route: ActivatedRoute,
    private deptSrv: DepartmentApiService,
    private taskSrv: TaskApiService,
    private router: Router,

  ) { }

  ngOnInit(): void {
    this.departmentId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.departmentId) {
      this.errorMessage = 'Invalid department ID';
      return;
    }
    this.loadDepartment();
  }

  loadDepartment(): void {
    this.loading = true;
    this.deptSrv.getDepartmentById(this.departmentId).subscribe({
      next: (res) => {
        this.department = res;
        this.userCount = this.department.users?.length || 0;
        
        // 🔍 Find and set HOD from the user list if not already provided
        if (!this.department.hod && this.department.users?.length) {
          this.hodUser = this.department.users.find(u => u.role === 'HOD') || null;
        } else {
          this.hodUser = this.department.hod || null;
        }
        
        this.loading = false;
        this.loadDepartmentTasks();
        this.initUserFilter();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load department.';
      }
    });
  }
   goBack(): void {
    this.router.navigate(['/departments']);
  }
  loadDepartmentTasks(): void {
    this.loadingTasks = true;
    this.taskSrv.getTasksByDepartment(this.departmentId).subscribe({
      next: (res) => {
        this.allDeptTasks = res.data || [];
        this.taskCount = this.allDeptTasks?.length || 0;
        this.applyTaskFilters();
        this.loadingTasks = false;
      },
      error: (err) => {
        this.loadingTasks = false;
        console.error(err);
      }
    });
  }

  toggleCollapse(section: 'tasks' | 'users'): void {
    this.collapsed[section] = !this.collapsed[section];
  }

  applyTaskFilters(): void {
    this.taskFiltered = this.allDeptTasks.filter(t => {
      const matchSearch = !this.taskSearch ||
        t.title?.toLowerCase().includes(this.taskSearch.toLowerCase());
      const matchStatus = !this.taskStatusFilter || t.status === this.taskStatusFilter;
      return matchSearch && matchStatus;
    });
    this.taskPage = 1;
  }

  resetTaskFilters(): void {
    this.taskSearch = '';
    this.taskStatusFilter = '';
    this.applyTaskFilters();
  }

  filterTasksByStatus(status: string): void {
    this.taskStatusFilter = status;
    this.applyTaskFilters();
    this.collapsed.tasks = false;
  }

  changeTaskPage(p: number): void {
    if (p >= 1 && p <= this.taskTotalPages) this.taskPage = p;
  }
  taskPages(): number[] {
    return Array.from({ length: this.taskTotalPages }, (_, i) => i + 1);
  }

  initUserFilter(): void {
    this.userFiltered = this.department.users || [];
    this.userPage = 1;
  }

  applyUserFilters(): void {
    const term = this.userSearch.toLowerCase();
    this.userFiltered = (this.department.users || []).filter(u =>
      u.fullName?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term)
    );
    this.userPage = 1;
  }

  changeUserPage(p: number): void {
    if (p >= 1 && p <= this.userTotalPages) this.userPage = p;
  }
  userPages(): number[] {
    return Array.from({ length: this.userTotalPages }, (_, i) => i + 1);
  }
}
