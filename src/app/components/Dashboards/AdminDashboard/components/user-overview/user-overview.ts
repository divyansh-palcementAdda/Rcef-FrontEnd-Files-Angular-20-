import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  status: 'active' | 'inactive' | 'pending';
  lastActive: Date;
  tasksCompleted: number;
  avatar?: string;
}

@Component({
  selector: 'app-user-overview',
  standalone: true,
  imports: [CommonModule, GradientCardComponent],
  templateUrl: './user-overview.html',
  styleUrls: ['./user-overview.css']
})
export class UserOverviewComponent {
  @Input() dashboardData: any = null;

  users: User[] = [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah.j@company.com',
      role: 'Project Manager',
      department: 'Development',
      status: 'active',
      lastActive: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      tasksCompleted: 142,
      avatar: 'SJ'
    },
    {
      id: 2,
      name: 'Mike Chen',
      email: 'mike.chen@company.com',
      role: 'Senior Developer',
      department: 'Development',
      status: 'active',
      lastActive: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      tasksCompleted: 89,
      avatar: 'MC'
    },
    {
      id: 3,
      name: 'Emily Davis',
      email: 'emily.davis@company.com',
      role: 'Marketing Lead',
      department: 'Marketing',
      status: 'active',
      lastActive: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      tasksCompleted: 67,
      avatar: 'ED'
    },
    {
      id: 4,
      name: 'Robert Wilson',
      email: 'robert.w@company.com',
      role: 'Sales Executive',
      department: 'Sales',
      status: 'inactive',
      lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      tasksCompleted: 45,
      avatar: 'RW'
    },
    {
      id: 5,
      name: 'Lisa Thompson',
      email: 'lisa.t@company.com',
      role: 'UX Designer',
      department: 'Design',
      status: 'pending',
      lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      tasksCompleted: 23,
      avatar: 'LT'
    }
  ];

  filteredUsers: User[] = [...this.users];
  searchTerm: string = '';
  statusFilter: string = 'all';
  departmentFilter: string = 'all';

  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      active: 'status-active',
      inactive: 'status-inactive',
      pending: 'status-pending'
    };
    return statusClasses[status] || 'status-unknown';
  }
asStatKey(key: unknown): string {
  return key as string;
}

  getStatusIcon(status: string): string {
    const statusIcons: { [key: string]: string } = {
      active: 'bi-check-circle',
      inactive: 'bi-x-circle',
      pending: 'bi-clock'
    };
    return statusIcons[status] || 'bi-question-circle';
  }
  /* Helper methods for template */
getStatIcon(key: string): string {
  const icons: { [key: string]: string } = {
    total: 'bi-people',
    active: 'bi-check-circle',
    inactive: 'bi-x-circle',
    pending: 'bi-clock',
    activePercentage: 'bi-graph-up'
  };
  return icons[key] || 'bi-circle';
}

getStatLabel(key: string): string {
  const labels: { [key: string]: string } = {
    total: 'Total Users',
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    activePercentage: 'Active %'
  };
  return labels[key] || key;
}

  getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesStatus = this.statusFilter === 'all' || user.status === this.statusFilter;
      const matchesDepartment = this.departmentFilter === 'all' || user.department === this.departmentFilter;
      
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }

  onSearchChange(event: any): void {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  onStatusFilterChange(event: any): void {
    this.statusFilter = event.target.value;
    this.applyFilters();
  }

  onDepartmentFilterChange(event: any): void {
    this.departmentFilter = event.target.value;
    this.applyFilters();
  }

  getDepartments(): string[] {
    return [...new Set(this.users.map(user => user.department))];
  }

  getStats(): any {
    const totalUsers = this.users.length;
    const activeUsers = this.users.filter(user => user.status === 'active').length;
    const inactiveUsers = this.users.filter(user => user.status === 'inactive').length;
    const pendingUsers = this.users.filter(user => user.status === 'pending').length;

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      pending: pendingUsers,
      activePercentage: Math.round((activeUsers / totalUsers) * 100)
    };
  }

  exportUserList(): void {
    console.log('Exporting user list...');
    // Implement export functionality
  }

  viewAllUsers(): void {
    console.log('Navigating to all users...');
    // Navigate to users page
  }
}