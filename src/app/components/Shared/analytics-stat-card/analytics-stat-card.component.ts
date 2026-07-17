import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analytics-stat-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-stat-card.component.html',
  styleUrls: ['./analytics-stat-card.component.css']
})
export class AnalyticsStatCardComponent {
  @Input() title = '';
  @Input() value: number | string = 0;
  @Input() iconClass = '';
  @Input() theme = 'blue';
  @Input() selected = false;
  @Input() subtitle?: string;

  @Output() cardClick = new EventEmitter<void>();

  onCardClick(): void {
    this.cardClick.emit();
  }
}
