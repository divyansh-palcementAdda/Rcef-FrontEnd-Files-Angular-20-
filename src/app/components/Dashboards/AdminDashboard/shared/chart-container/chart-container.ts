import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var ApexCharts: any;

@Component({
  selector: 'app-chart-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-container.html',
  styleUrls: ['./chart-container.css']
})
export class ChartContainerComponent implements AfterViewInit, OnDestroy {
  @Input() chartId: string = `chart-${Math.random().toString(36).substr(2, 9)}`;
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() height: number = 350;
  @Input() chartOptions: any = {};
  @ViewChild('chartElement') chartElement!: ElementRef;

  private chart: any;

  ngAfterViewInit(): void {
    this.initChart();
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  private initChart(): void {
    if (typeof ApexCharts === 'undefined') {
      console.warn('ApexCharts not loaded');
      return;
    }

    const defaultOptions = {
      chart: {
        type: 'line',
        height: this.height,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        }
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3,
          stops: [0, 90, 100]
        }
      },
      grid: {
        borderColor: '#f3f4f6',
        strokeDashArray: 4
      },
      theme: {
        mode: 'light'
      }
    };

    const options = { ...defaultOptions, ...this.chartOptions };
    this.chart = new ApexCharts(this.chartElement.nativeElement, options);
    this.chart.render();
  }

  updateChart(options: any): void {
    if (this.chart) {
      this.chart.updateOptions(options);
    }
  }
}