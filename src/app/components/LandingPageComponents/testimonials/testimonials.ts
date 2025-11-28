import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  avatar: string;
  quote: string;
  rating: number;
}
@Component({
  selector: 'app-testimonials',
  imports: [CommonModule],
  templateUrl: './testimonials.html',
  styleUrl: './testimonials.css'
})
export class Testimonials {

 // todo: Update with actual avatar image paths
  testimonials = signal<Testimonial[]>([
    {
      name: 'Sarah Chen',
      role: 'VP of Operations',
      company: 'TechFlow Inc',
      avatar: 'assets/images/testimonial-sarah.png',
      quote: 'AreYouReporting transformed how our teams collaborate. We\'ve reduced reporting time by 70% and improved project visibility across all departments.',
      rating: 5
    },
    {
      name: 'Michael Torres',
      role: 'Engineering Director',
      company: 'DataScale',
      avatar: 'assets/images/testimonial-michael.png',
      quote: 'The automated reporting feature alone is worth it. Our standup meetings are now focused on solutions, not status updates. Game changer for productivity.',
      rating: 5
    },
    {
      name: 'Emily Rodriguez',
      role: 'Product Manager',
      company: 'CloudVentures',
      avatar: 'assets/images/testimonial-emily.png',
      quote: 'Finally, a task management tool that understands how modern teams work. The clear reporting structure helps us make better decisions faster.',
      rating: 5
    }
  ]);

  getStars(count: number): number[] {
    return Array(count).fill(0);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }
}
