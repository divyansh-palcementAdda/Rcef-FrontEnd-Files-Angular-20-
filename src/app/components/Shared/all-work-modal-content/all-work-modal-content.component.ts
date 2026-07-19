import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SubDepartmentRowDTO,
  UserRowDTO,
  WorkAnalyticsResponse,
  WorkDashboardResponse
} from '../../../Services/all-work-api.service';

export type AllWorkModalView = 'users' | 'tasks' | 'analytics' | '';

@Component({
  selector: 'app-all-work-modal-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './all-work-modal-content.component.html',
  styleUrls: ['./all-work-modal-content.component.css']
})
export class AllWorkModalContentComponent {
  @Input() modalView: AllWorkModalView = '';
  @Input() users: UserRowDTO[] = [];
  @Input() loadingUsers = false;
  @Input() userSearch = '';
  @Input() dashboardData: WorkDashboardResponse | null = null;
  @Input() selectedSubDept: SubDepartmentRowDTO | null = null;
  @Input() selectedUser: UserRowDTO | null = null;
  @Input() tasks: any[] = [];
  @Input() loadingTasks = false;
  @Input() taskSearch = '';
  @Input() taskStatus = 'ALL';
  @Input() statusTabs: Array<{ label: string; value: string }> = [];
  @Input() loadingAnalytics = false;
  @Input() analytics: WorkAnalyticsResponse | null = null;

  @Output() userSearchChange = new EventEmitter<string>();
  @Output() taskSearchChange = new EventEmitter<string>();
  @Output() statusTabSelect = new EventEmitter<string>();
  @Output() exportUsers = new EventEmitter<string>();
  @Output() exportTasks = new EventEmitter<string>();
  @Output() openUserTasks = new EventEmitter<UserRowDTO>();
  @Output() openUserAnalytics = new EventEmitter<UserRowDTO>();
  @Output() navigateEntity = new EventEmitter<{ type: 'task' | 'user' | 'sub-department' | 'department'; id: any; event?: Event }>();

  onNavigateEntity(type: 'task' | 'user' | 'sub-department' | 'department', id: any, event?: Event): void {
    this.navigateEntity.emit({ type, id, event });
  }
}
