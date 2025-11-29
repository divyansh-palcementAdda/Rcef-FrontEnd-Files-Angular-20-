import { Component, Input, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartContainerComponent } from '../../shared/chart-container/chart-container';
import { GradientCardComponent } from '../../shared/gradient-card/gradient-card';

declare var ApexCharts: any;

@Component({
  selector: 'app-advanced-analytics',
  standalone: true,
  imports: [CommonModule, GradientCardComponent, ChartContainerComponent],
  templateUrl: './advanced-analytics.html',
  styleUrls: ['./advanced-analytics.css']
})
export class AdvancedAnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() dashboardData: any = null;

  private charts: any[] = [];
  activeTab: string = 'overview';

  // Sample analytics data
  analyticsData = {
    taskDistribution: {
      labels: ['Completed', 'In Progress', 'Pending', 'Delayed', 'Upcoming'],
      series: [35, 25, 20, 12, 8]
    },
    performanceTrend: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      completed: [65, 78, 82, 79, 86, 90, 85],
      created: [45, 52, 48, 60, 55, 65, 70]
    },
    departmentMetrics: {
      labels: ['Development', 'Marketing', 'Sales', 'Support', 'HR'],
      efficiency: [85, 72, 68, 90, 65],
      workload: [75, 60, 80, 55, 45]
    }
  };

  // Chart configurations
  taskDistributionChart: any = {
    chart: {
      type: 'donut',
      height: 350
    },
    series: this.analyticsData.taskDistribution.series,
    labels: this.analyticsData.taskDistribution.labels,
    colors: ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'],
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          background: 'transparent'
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },
    stroke: {
      width: 0
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 200
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  };

  performanceTrendChart: any = {
    chart: {
      type: 'line',
      height: 350,
      toolbar: {
        show: true
      }
    },
    series: [{
      name: 'Tasks Completed',
      data: this.analyticsData.performanceTrend.completed
    }, {
      name: 'Tasks Created',
      data: this.analyticsData.performanceTrend.created
    }],
    xaxis: {
      categories: this.analyticsData.performanceTrend.categories
    },
    colors: ['#6366f1', '#10b981'],
    stroke: {
      width: 3,
      curve: 'smooth'
    },
    markers: {
      size: 5,
      hover: {
        size: 7
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        gradientToColors: ['#a855f7', '#34d399'],
        shadeIntensity: 1,
        type: 'vertical',
        opacityFrom: 0.7,
        opacityTo: 0.2,
        stops: [0, 90, 100]
      }
    },
    yaxis: {
      min: 0,
      max: 100
    },
    grid: {
      borderColor: '#f3f4f6',
      strokeDashArray: 4
    }
  };

  departmentComparisonChart: any = {
    chart: {
      type: 'bar',
      height: 350,
      stacked: false,
      toolbar: {
        show: true
      }
    },
    series: [{
      name: 'Efficiency %',
      data: this.analyticsData.departmentMetrics.efficiency
    }, {
      name: 'Workload %',
      data: this.analyticsData.departmentMetrics.workload
    }],
    xaxis: {
      categories: this.analyticsData.departmentMetrics.labels
    },
    colors: ['#6366f1', '#f59e0b'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 8,
        borderRadiusApplication: 'end'
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    fill: {
      opacity: 1,
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'vertical',
        shadeIntensity: 0.5,
        gradientToColors: ['#a855f7', '#f59e0b'],
        opacityFrom: 0.8,
        opacityTo: 0.6,
        stops: [0, 90, 100]
      }
    },
    grid: {
      borderColor: '#f3f4f6',
      strokeDashArray: 4
    }
  };

  ngOnInit(): void {
    // Initialize with real data if available
    if (this.dashboardData) {
      this.updateChartsWithRealData();
    }
  }

  ngAfterViewInit(): void {
    this.initCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private initCharts(): void {
    if (typeof ApexCharts !== 'undefined') {
      // Charts will be initialized by ChartContainer components
    }
  }

  private destroyCharts(): void {
    this.charts.forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    this.charts = [];
  }

  private updateChartsWithRealData(): void {
    // Update chart data with real dashboard data
    if (this.dashboardData.totalTask && this.dashboardData.completedTask) {
      const completedPercentage = Math.round((this.dashboardData.completedTask / this.dashboardData.totalTask) * 100);
      this.analyticsData.taskDistribution.series[0] = completedPercentage;
    }
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  exportChartData(format: 'csv' | 'pdf' | 'png'): void {
    console.log(`Exporting chart data as ${format}`);
    // Implement export functionality
    // This would typically download the chart data or image
  }

  getPerformanceInsights(): any {
    const latestCompleted = this.analyticsData.performanceTrend.completed.slice(-1)[0];
    const previousCompleted = this.analyticsData.performanceTrend.completed.slice(-2)[0];
    const growth = ((latestCompleted - previousCompleted) / previousCompleted) * 100;

    return {
      currentPerformance: latestCompleted,
      growth: growth,
      trend: growth >= 0 ? 'up' : 'down',
      message: growth >= 0 ? 
        `Performance improved by ${growth.toFixed(1)}% from last month` :
        `Performance decreased by ${Math.abs(growth).toFixed(1)}% from last month`
    };
  }
}