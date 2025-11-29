import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartContainerComponent } from '../../shared/chart-container/chart-container';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';


export interface Department {
  id: number;
  name: string;
  manager: string;
  employeeCount: number;
  taskCount: number;
  completedTasks: number;
  efficiency: number;
  workload: number;
  budget: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
}

@Component({
  selector: 'app-department-stats',
  standalone: true,
  imports: [CommonModule, GradientCardComponent, ChartContainerComponent],
  templateUrl: './department-stats.html',
  styleUrls: ['./department-stats.css']
})
export class DepartmentStatsComponent implements OnInit {
  @Input() dashboardData: any = null;

  departments: Department[] = [
    {
      id: 1,
      name: 'Development',
      manager: 'Sarah Johnson',
      employeeCount: 24,
      taskCount: 156,
      completedTasks: 142,
      efficiency: 85,
      workload: 75,
      budget: 450000,
      trend: 'up',
      color: '#6366f1'
    },
    {
      id: 2,
      name: 'Marketing',
      manager: 'Emily Davis',
      employeeCount: 12,
      taskCount: 89,
      completedTasks: 67,
      efficiency: 72,
      workload: 60,
      budget: 220000,
      trend: 'up',
      color: '#10b981'
    },
    {
      id: 3,
      name: 'Sales',
      manager: 'Robert Wilson',
      employeeCount: 18,
      taskCount: 134,
      completedTasks: 98,
      efficiency: 68,
      workload: 80,
      budget: 320000,
      trend: 'down',
      color: '#f59e0b'
    },
    {
      id: 4,
      name: 'Support',
      manager: 'Lisa Thompson',
      employeeCount: 8,
      taskCount: 67,
      completedTasks: 62,
      efficiency: 90,
      workload: 55,
      budget: 180000,
      trend: 'up',
      color: '#ec4899'
    },
    {
      id: 5,
      name: 'HR',
      manager: 'Mike Chen',
      employeeCount: 6,
      taskCount: 45,
      completedTasks: 38,
      efficiency: 65,
      workload: 45,
      budget: 150000,
      trend: 'stable',
      color: '#8b5cf6'
    }
  ];

  performanceChart: any = {
    chart: {
      type: 'radar',
      height: 350,
      toolbar: {
        show: true
      }
    },
    series: [{
      name: 'Performance Score',
      data: this.departments.map(dept => dept.efficiency)
    }],
    labels: this.departments.map(dept => dept.name),
    colors: ['#6366f1'],
    plotOptions: {
      radar: {
        size: 120,
        polygons: {
          strokeColors: '#e5e7eb',
          connectorColors: '#e5e7eb',
          fill: {
            colors: ['#f8fafc', '#fff']
          }
        }
      }
    },
    markers: {
      size: 4,
      colors: ['#fff'],
      strokeColors: '#6366f1',
      strokeWidth: 2
    },
    tooltip: {
      y: {
        formatter: function(val: number) {
          return val + '%'
        }
      }
    },
    yaxis: {
      tickAmount: 4,
      min: 0,
      max: 100,
      labels: {
        formatter: function(val: number) {
          return val + '%'
        }
      }
    }
  };

  workloadChart: any = {
    chart: {
      type: 'bar',
      height: 300,
      toolbar: {
        show: false
      }
    },
    series: [{
      name: 'Workload %',
      data: this.departments.map(dept => dept.workload)
    }],
    labels: this.departments.map(dept => dept.name),
    colors: this.departments.map(dept => dept.color),
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        borderRadiusApplication: 'end',
        barHeight: '70%'
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return val + '%'
      },
      style: {
        colors: ['#fff'],
        fontSize: '12px',
        fontWeight: 'bold'
      }
    },
    grid: {
      borderColor: '#f3f4f6',
      strokeDashArray: 4
    },
    xaxis: {
      max: 100,
      labels: {
        formatter: function(val: number) {
          return val + '%'
        }
      }
    }
  };

  ngOnInit(): void {
    this.updateCharts();
  }

  private updateCharts(): void {
    // Update charts with department data
    this.performanceChart.series = [{
      name: 'Performance Score',
      data: this.departments.map(dept => dept.efficiency)
    }];

    this.workloadChart.series = [{
      name: 'Workload %',
      data: this.departments.map(dept => dept.workload)
    }];
  }

  getTrendIcon(trend: string): string {
    const icons = {
      up: 'bi-arrow-up-right',
      down: 'bi-arrow-down-right',
      stable: 'bi-dash'
    };
    return icons[trend as keyof typeof icons] || 'bi-circle';
  }

  getTrendColor(trend: string): string {
    const colors = {
      up: 'success',
      down: 'danger',
      stable: 'warning'
    };
    return colors[trend as keyof typeof colors] || 'secondary';
  }

  getEfficiencyClass(efficiency: number): string {
    if (efficiency >= 80) return 'efficiency-high';
    if (efficiency >= 60) return 'efficiency-medium';
    return 'efficiency-low';
  }

  getWorkloadClass(workload: number): string {
    if (workload >= 80) return 'workload-high';
    if (workload >= 60) return 'workload-medium';
    return 'workload-low';
  }

  formatBudget(budget: number): string {
    return '$' + (budget / 1000).toFixed(0) + 'K';
  }

  getCompletionRate(dept: Department): number {
    return Math.round((dept.completedTasks / dept.taskCount) * 100);
  }

  viewDepartmentDetails(dept: Department): void {
    console.log('Viewing department:', dept.name);
    // Navigate to department details
  }

  exportDepartmentReport(): void {
    console.log('Exporting department report...');
    // Implement export functionality
  }
}