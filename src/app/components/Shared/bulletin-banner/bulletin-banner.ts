import { Component, Input, OnInit } from '@angular/core';

interface DepartmentTaskInfo {
  departmentName: string;
  pendingTasks: number;
}

@Component({
  selector: 'app-bulletin-banner',
  templateUrl: './bulletin-banner.html',
  styleUrls: ['./bulletin-banner.css']
})
export class BulletinBannerComponent implements OnInit {

  @Input() delayedTasksCount: number = 0;
  @Input() departmentsWithPending: DepartmentTaskInfo[] = [];

  headlineText: string = '';

  ngOnInit(): void {
    this.generateBulletinText();
  }

  ngOnChanges(): void {
    this.generateBulletinText();
  }

  private generateBulletinText(): void {
    if (!this.departmentsWithPending?.length) {
      this.headlineText = `No pending tasks. All departments are on schedule ✅`;
      return;
    }

    const deptInfo = this.departmentsWithPending
      .map(d => `${d.departmentName} (${d.pendingTasks} pending)`)
      .join(' • ');

    this.headlineText = `🚨 ${this.delayedTasksCount} delayed task(s)! Departments with most pending work: ${deptInfo}`;
  }
}
