import { animation, animate, style, useAnimation } from '@angular/animations';

export const fadeInUp = animation([
  style({ opacity: 0, transform: 'translateY(20px)' }),
  animate('{{ time }} ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
], { params: { time: '600ms' } });