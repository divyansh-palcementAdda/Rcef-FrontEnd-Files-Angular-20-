// home.component.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from '../../../Services/auth-api-service';

interface Stat {
  icon: string;
  label: string;
  value: string;
  trend: string;
  color: string;
}

interface ProgressItem {
  label: string;
  value: number;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Testimonial {
  name: string;
  role: string;
  company: string;
  avatar: string;
  quote: string;
  rating: number;
}

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface FooterSection {
  title: string;
  links: { label: string; href: string; }[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home {
  // Hero Section - Using placeholder image for demo
  // Replace with your actual dashboard mockup path
  heroDashboardImage = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&fit=crop';
    constructor(private router: Router, private authService: AuthApiService) {}

  // Stats Section
  stats = signal<Stat[]>([
    {
      icon: 'check-circle',
      label: 'Tasks Completed',
      value: '1,247',
      trend: '+12%',
      color: 'green'
    },
    {
      icon: 'trending-up',
      label: 'Team Performance',
      value: '94%',
      trend: '+8%',
      color: 'primary'
    },
    {
      icon: 'users',
      label: 'Active Members',
      value: '48',
      trend: '+3',
      color: 'purple'
    },
    {
      icon: 'file-text',
      label: 'Reports Generated',
      value: '156',
      trend: '+24%',
      color: 'blue'
    }
  ]);

  // Progress Data
  taskProgress = signal<ProgressItem[]>([
    { label: 'Development', value: 85 },
    { label: 'Design', value: 92 }
  ]);

  teamActivity = signal<ProgressItem[]>([
    { label: 'Marketing', value: 78 },
    { label: 'Sales', value: 65 }
  ]);

  completionRate = signal<ProgressItem[]>([
    { label: 'This Week', value: 94 },
    { label: 'This Month', value: 88 }
  ]);

  // Features Section
  features = signal<Feature[]>([
    {
      icon: 'check-circle',
      title: 'Task Tracking',
      description: 'Monitor every task from creation to completion with intelligent status updates and priority management.'
    },
    {
      icon: 'bar-chart',
      title: 'Automated Reports',
      description: 'Generate comprehensive reports automatically. No more manual data collection or status meetings.'
    },
    {
      icon: 'users',
      title: 'Team Collaboration',
      description: 'Seamless collaboration with real-time updates, comments, and file sharing across departments.'
    },
    {
      icon: 'layers',
      title: 'Department Assignment',
      description: 'Smart task distribution based on department expertise, workload, and availability.'
    },
    {
      icon: 'trending-up',
      title: 'Performance Charts',
      description: 'Visualize productivity trends, bottlenecks, and team performance with interactive analytics.'
    },
    {
      icon: 'zap',
      title: 'Real-time Updates',
      description: 'Stay synchronized with instant notifications and live progress tracking across all devices.'
    }
  ]);

  // Benefits Section
  benefits = signal<Benefit[]>([
    {
      icon: 'bot',
      title: 'Automated Workflows',
      description: 'Reduce manual work with intelligent automation that handles repetitive tasks and reporting.'
    },
    {
      icon: 'eye',
      title: 'Complete Visibility',
      description: 'Get real-time insights into team performance, project status, and potential bottlenecks.'
    },
    {
      icon: 'gauge',
      title: 'Performance Metrics',
      description: 'Track key performance indicators with customizable dashboards and detailed analytics.'
    }
  ]);

  // Testimonials Section
  testimonials = signal<Testimonial[]>([
    {
      name: 'Sarah Chen',
      role: 'VP of Operations',
      company: 'TechFlow Inc',
      avatar: 'https://i.pravatar.cc/150?img=1',
      quote: 'AreYouReporting transformed how our teams collaborate. We\'ve reduced reporting time by 70% and improved project visibility across all departments.',
      rating: 5
    },
    {
      name: 'Michael Torres',
      role: 'Engineering Director',
      company: 'DataScale',
      avatar: 'https://i.pravatar.cc/150?img=2',
      quote: 'The automated reporting feature alone is worth it. Our standup meetings are now focused on solutions, not status updates. Game changer for productivity.',
      rating: 5
    },
    {
      name: 'Emily Rodriguez',
      role: 'Product Manager',
      company: 'CloudVentures',
      avatar: 'https://i.pravatar.cc/150?img=3',
      quote: 'Finally, a task management tool that understands how modern teams work. The clear reporting structure helps us make better decisions faster.',
      rating: 5
    }
  ]);

  // Footer Section
  email = signal('');
  footerSections = signal<FooterSection[]>([
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Dashboard', href: '#' },
        { label: 'Integrations', href: '#' },
        { label: 'Documentation', href: '#' }
      ]
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Press Kit', href: '#' }
      ]
    },
    {
      title: 'Resources',
      links: [
        { label: 'Help Center', href: '#' },
        { label: 'Community', href: '#' },
        { label: 'Tutorials', href: '#' },
        { label: 'Contact', href: '#' }
      ]
    }
  ]);

  socialLinks = signal([
    { name: 'github', icon: 'github' },
    { name: 'twitter', icon: 'twitter' },
    { name: 'linkedin', icon: 'linkedin' },
    { name: 'mail', icon: 'mail' }
  ]);

  // Methods
  getStars(count: number): number[] {
    return Array(count).fill(0);
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }

  onSubscribe(): void {
    if (this.email()) {
      console.log('Subscribe clicked with email:', this.email());
      // Implement newsletter subscription logic here
      this.email.set('');
    }
  }

  updateEmail(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.email.set(input.value);
  }

dashboard() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.authService.goToDashboard();
    } else {
      this.router.navigate(['/login']);
    }
  }
}