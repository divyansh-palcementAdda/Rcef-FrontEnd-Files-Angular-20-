import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type GradientVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-gradient-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gradient-card.html',
  styleUrls: ['./gradient-card.css']
})
export class GradientCardComponent {
  @Input() variant: GradientVariant = 'primary';
  @Input() hoverable: boolean = true;
  @Input() clickable: boolean = false;
  @Input() padding: string = '1.5rem';
  @Input() borderRadius: string = '1.25rem';
  @Output() cardClick = new EventEmitter<void>();

  get gradientClass(): string {
    return `gradient-card-${this.variant}`;
  }

  get gradientStyle(): { [key: string]: string } {
    const gradients = {
      primary: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
      success: 'linear-gradient(135deg, #10b981, #059669)',
      warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
      danger: 'linear-gradient(135deg, #ef4444, #dc2626)',
      info: 'linear-gradient(135deg, #06b6d4, #0891b2)'
    };
    
    return {
      '--card-gradient': gradients[this.variant]
    };
  }

  onClick(): void {
    if (this.clickable) {
      this.cardClick.emit();
    }
  }
}