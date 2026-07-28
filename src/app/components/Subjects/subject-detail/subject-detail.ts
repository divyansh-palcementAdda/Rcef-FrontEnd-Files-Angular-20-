import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SubjectApiService } from '../../../Services/subject-api.service';
import { SubjectDetail } from '../../../Model/subject';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-subject-detail',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  templateUrl: './subject-detail.html',
  styleUrls: ['./subject-detail.css']
})
export class SubjectDetailComponent implements OnInit {
  subjectId!: number;
  subjectDetail: SubjectDetail | null = null;
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private subjectApi: SubjectApiService,
    private snackBar: MatSnackBar,
    private location: Location
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.subjectId = +idParam;
      this.loadSubjectDetail();
    } else {
      this.showError('Invalid subject ID');
      this.goBack();
    }
  }

  loadSubjectDetail(): void {
    this.loading = true;
    this.subjectApi.getSubjectDetail(this.subjectId).subscribe({
      next: (detail: SubjectDetail) => {
        this.subjectDetail = detail;
        this.loading = false;
      },
      error: (err: any) => {
        this.showError('Failed to load subject details: ' + err.message);
        this.loading = false;
      }
    });
  }

  goBack(): void {
    this.location.back();
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
