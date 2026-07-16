import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DepartmentApiService } from '../../../Services/department-api-service';
import { UserApiService } from '../../../Services/UserApiService';
import { Department } from '../../../Model/department';
import { userDto } from '../../../Model/userDto';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface SubDepartmentDetail {
  id: string;
  name: string;
  code: string;
  description: string;
  department: Department;
  assignedUsers?: userDto[];
  recentActivity?: ActivityLog[];
  analytics?: SubDepartmentAnalytics;
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  updatedByName?: string;
}

interface ActivityLog {
  action: string;
  details: string;
  timestamp: string;
  performedBy: string;
}

interface SubDepartmentAnalytics {
  totalUsers: number;
  totalTeachers: number;
  totalHods: number;
  totalTasks: number;
  pendingTasks: number;
  upcomingTasks: number;
  inProgressTasks: number;
  closedTasks: number;
  delayedTasks: number;
  extendedTasks: number;
  requestForClosure: number;
  requestForExtension: number;
}

@Component({
  selector: 'app-sub-department-details',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  templateUrl: './sub-department-details.html',
  styleUrls: ['./sub-department-details.css']
})
export class SubDepartmentDetailsComponent implements OnInit {
  subDeptId!: string;
  subDeptDetail: SubDepartmentDetail | null = null;
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private deptApiService: DepartmentApiService,
    private userApiService: UserApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.subDeptId = idParam;
      this.loadSubDepartmentDetail();
    } else {
      this.showError('Invalid sub-department ID');
      this.goBack();
    }
  }

  loadSubDepartmentDetail(): void {
    this.loading = true;
    
    // Load sub-department details
    this.deptApiService.getSubDepartmentById(this.subDeptId).subscribe({
      next: (detail: SubDepartmentDetail) => {
        this.subDeptDetail = detail;
        this.loading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load sub-department details: ' + err.message);
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/sub-departments']);
  }

  showError(msg: string): void {
    this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: ['snackbar-error'] });
  }

  getRoleBadgeClass(role: string): string {
    if (!role) return '';
    const r = role.toLowerCase();
    if (r.includes('teacher')) return 'role-teacher';
    if (r.includes('hod')) return 'role-hod';
    if (r.includes('sub_admin') || r.includes('admin')) return 'role-admin';
    if (r.includes('super_admin')) return 'role-super';
    return '';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  }
}
