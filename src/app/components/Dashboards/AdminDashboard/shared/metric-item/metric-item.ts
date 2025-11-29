import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type MetricTrend = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-metric-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-item.html',
  styleUrls: ['./metric-item.css']
})
export class MetricItemComponent {
  @Input() label: string = '';
  @Input() value: string | number = '';
  @Input() trend: MetricTrend = 'neutral';
  @Input() trendValue: string = '';
  @Input() icon: string = '';
  @Input() color: 'primary' | 'success' | 'warning' | 'danger' | 'info' = 'primary';
}
