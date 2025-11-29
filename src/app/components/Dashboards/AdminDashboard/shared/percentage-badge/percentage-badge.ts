import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'positive' | 'negative' | 'neutral';

@Component({
  selector: 'app-percentage-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './percentage-badge.html',
  styleUrls: ['./percentage-badge.css']
})
export class PercentageBadgeComponent {
  @Input() value: number = 0;
  @Input() variant: BadgeVariant = 'neutral';
  @Input() showIcon: boolean = true;

  get displayValue(): string {
    return this.value > 0 ? `+${this.value}%` : `${this.value}%`;
  }

  get iconClass(): string {
    if (this.value > 0) return 'bi-arrow-up-right';
    if (this.value < 0) return 'bi-arrow-down-right';
    return 'bi-dash';
  }
}