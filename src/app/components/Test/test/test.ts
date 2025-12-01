// home.component.ts
import { Component, signal, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
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

interface Activity {
  user: string;
  action: string;
  time: string;
  avatar: string;
  color: string;
}

interface Integration {
  name: string;
  icon: string;
  description: string;
  color: string;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  avatar: string;
  social: string[];
}

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  ctaText: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './test.html',
  styleUrls: ['./test.css']
})
export class Test implements OnInit, AfterViewInit {
  @ViewChild('particleCanvas') particleCanvas!: ElementRef<HTMLCanvasElement>;
  
  // Hero Section
  heroDashboardImage = 'assets/images/hero_dashboard_mockup_illustration.png';
  dashboardAnalyticsPreview = 'assets/images/dashboard_analytics_preview_mockup.png';
  
  // Billing toggle
  annualBilling = signal(false);

  constructor(private router: Router, private authService: AuthApiService) {}

  ngOnInit() {
    this.initScrollAnimations();
  }

  ngAfterViewInit() {
    this.initParticles();
  }

  // Stats Section
  stats = signal<Stat[]>([
    {
      icon: 'check-circle',
      label: 'Tasks Completed',
      value: '12,847',
      trend: '+24%',
      color: 'green'
    },
    {
      icon: 'trending-up',
      label: 'Team Performance',
      value: '96%',
      trend: '+12%',
      color: 'primary'
    },
    {
      icon: 'clock',
      label: 'Time Saved Weekly',
      value: '42hrs',
      trend: '+18%',
      color: 'orange'
    },
    {
      icon: 'users',
      label: 'Active Members',
      value: '2,148',
      trend: '+156',
      color: 'purple'
    },
    {
      icon: 'file-text',
      label: 'Reports Generated',
      value: '8,456',
      trend: '+48%',
      color: 'blue'
    },
    {
      icon: 'award',
      label: 'Client Satisfaction',
      value: '4.9/5',
      trend: '+0.3',
      color: 'pink'
    }
  ]);

  // Recent Activities
  recentActivities = signal<Activity[]>([
    {
      user: 'Alex Johnson',
      action: 'completed the dashboard design',
      time: '2 minutes ago',
      avatar: 'https://i.pravatar.cc/150?img=4',
      color: 'green'
    },
    {
      user: 'Maria Garcia',
      action: 'assigned 3 new tasks to Dev team',
      time: '15 minutes ago',
      avatar: 'https://i.pravatar.cc/150?img=5',
      color: 'blue'
    },
    {
      user: 'David Kim',
      action: 'uploaded project documentation',
      time: '1 hour ago',
      avatar: 'https://i.pravatar.cc/150?img=6',
      color: 'purple'
    },
    {
      user: 'Sarah Wilson',
      action: 'reviewed Q3 performance report',
      time: '2 hours ago',
      avatar: 'https://i.pravatar.cc/150?img=7',
      color: 'pink'
    }
  ]);

  // Progress Data
  taskProgress = signal<ProgressItem[]>([
    { label: 'Development', value: 85 },
    { label: 'Design', value: 92 },
    { label: 'QA Testing', value: 78 }
  ]);

  teamActivity = signal<ProgressItem[]>([
    { label: 'Marketing', value: 78 },
    { label: 'Sales', value: 65 },
    { label: 'Support', value: 89 }
  ]);

  completionRate = signal<ProgressItem[]>([
    { label: 'This Week', value: 94 },
    { label: 'This Month', value: 88 },
    { label: 'This Quarter', value: 91 }
  ]);

  // Integrations
  integrations = signal<Integration[]>([
    {
      name: 'Slack',
      icon: 'slack',
      description: 'Real-time notifications and team collaboration',
      color: '#4A154B'
    },
    {
      name: 'Jira',
      icon: 'jira',
      description: 'Seamless task synchronization',
      color: '#0052CC'
    },
    {
      name: 'GitHub',
      icon: 'github',
      description: 'Automated code deployment tracking',
      color: '#181717'
    },
    {
      name: 'Google Drive',
      icon: 'drive',
      description: 'Direct file attachment and sharing',
      color: '#4285F4'
    },
    {
      name: 'Microsoft Teams',
      icon: 'teams',
      description: 'Integrated meetings and discussions',
      color: '#6264A7'
    },
    {
      name: 'Notion',
      icon: 'notion',
      description: 'Sync documentation and wikis',
      color: '#000000'
    }
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

  // Team Members
  teamMembers = signal<TeamMember[]>([
    {
      name: 'Emma Wilson',
      role: 'Product Lead',
      bio: '10+ years in product management, passionate about building tools that solve real problems.',
      avatar: 'https://i.pravatar.cc/150?img=8',
      social: ['twitter', 'linkedin']
    },
    {
      name: 'Michael Chen',
      role: 'Engineering Director',
      bio: 'Former tech lead at Google, specializes in scalable architecture and system design.',
      avatar: 'https://i.pravatar.cc/150?img=9',
      social: ['github', 'linkedin']
    },
    {
      name: 'Sophia Rodriguez',
      role: 'UX Designer',
      bio: 'Award-winning designer focused on creating intuitive and beautiful user experiences.',
      avatar: 'https://i.pravatar.cc/150?img=10',
      social: ['dribbble', 'twitter']
    }
  ]);

  // Pricing Plans
  pricingPlans = signal<PricingPlan[]>([
    {
      name: 'Starter',
      price: '$29',
      period: 'per month',
      description: 'Perfect for small teams getting started',
      features: [
        'Up to 10 team members',
        'Basic task management',
        'Weekly reports',
        'Email support',
        '1GB storage',
        'Basic integrations'
      ],
      highlighted: false,
      ctaText: 'Start Free Trial'
    },
    {
      name: 'Professional',
      price: '$79',
      period: 'per month',
      description: 'For growing teams with advanced needs',
      features: [
        'Up to 50 team members',
        'Advanced analytics',
        'Real-time collaboration',
        'Priority support',
        'Custom integrations',
        '10GB storage',
        'API access'
      ],
      highlighted: true,
      ctaText: 'Get Started'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'tailored pricing',
      description: 'For large organizations with complex workflows',
      features: [
        'Unlimited team members',
        'Dedicated account manager',
        'Custom reporting',
        'On-premise deployment',
        'SLA guarantee',
        'Unlimited storage',
        'White-labeling'
      ],
      highlighted: false,
      ctaText: 'Contact Sales'
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
        { label: 'Documentation', href: '#' },
        { label: 'API', href: '#' },
        { label: 'Status', href: '#' }
      ]
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Press Kit', href: '#' },
        { label: 'Contact', href: '#' },
        { label: 'Partners', href: '#' }
      ]
    },
    {
      title: 'Resources',
      links: [
        { label: 'Help Center', href: '#' },
        { label: 'Community', href: '#' },
        { label: 'Tutorials', href: '#' },
        { label: 'Webinars', href: '#' },
        { label: 'Templates', href: '#' },
        { label: 'Support', href: '#' }
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

  getIntegrationIcon(icon: string): string {
    const icons: { [key: string]: string } = {
      slack: 'M6.29 14.29L4.71 12.71L3.29 14.71L4.71 16.29L6.29 14.29ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z',
      jira: 'M12 2L22 12L12 22L2 12L12 2ZM12 6L15 12L12 18L9 12L12 6Z',
      github: 'M12 2C6.48 2 2 6.48 2 12C2 16.42 4.87 20.17 8.84 21.5C9.34 21.58 9.5 21.27 9.5 21V19.5C6.5 20 6 18 6 18C5.5 17 4.5 16 4.5 16C3.5 15 4.5 15 4.5 15C5.5 15 6 16 6 16C7 17 8 17.5 9 17C9 16 9.33 15.5 9.67 15.17C7.5 14.83 5.33 14 5.33 10C5.33 8.67 5.83 7.67 6.67 7C6.5 6.67 6 5.67 6 4.5C6 3.33 7 2.67 9 2.5C9.67 2.33 10.33 2.33 11 2.5C13 2.67 14 3.33 14 4.5C14 5.67 13.5 6.67 13.33 7C14.17 7.67 14.67 8.67 14.67 10C14.67 14 12.5 14.83 10.33 15.17C10.67 15.5 11 16 11 17V21C11 21.27 11.17 21.58 11.67 21.5C15.63 20.17 18.5 16.42 18.5 12C18.5 6.48 14.02 2 12 2Z',
      drive: 'M12 2L6 12L12 22L18 12L12 2ZM12 6L15 12L12 18L9 12L12 6Z',
      teams: 'M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 20 12 20ZM12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 4 12 4Z',
      notion: 'M4 4H20V20H4V4ZM6 6V18H18V6H6ZM9 9H15V11H9V9ZM9 13H15V15H9V13Z'
    };
    return icons[icon] || '';
  }

  getPlanPrice(plan: PricingPlan): string {
    if (plan.name === 'Enterprise') return plan.price;
    if (this.annualBilling()) {
      const monthlyPrice = parseInt(plan.price.replace('$', ''));
      const annualPrice = monthlyPrice * 12 * 0.8; // 20% discount
      return `$${Math.round(annualPrice)}`;
    }
    return plan.price;
  }

  togglePricing(): void {
    this.annualBilling.set(!this.annualBilling());
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

  scrollToFeatures(): void {
    const featuresSection = document.getElementById('features');
    featuresSection?.scrollIntoView({ behavior: 'smooth' });
  }

  scrollToStats(): void {
    const statsSection = document.getElementById('stats');
    statsSection?.scrollIntoView({ behavior: 'smooth' });
  }

  // Particle Animation
  private initParticles(): void {
    const canvas = this.particleCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
    }> = [];
    
    const particleColors = [
      'rgba(99, 102, 241, 0.3)',
      'rgba(168, 85, 247, 0.3)',
      'rgba(236, 72, 153, 0.3)',
      'rgba(59, 130, 246, 0.3)'
    ];
    
    // Create particles
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        color: particleColors[Math.floor(Math.random() * particleColors.length)]
      });
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(particle => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Bounce off edges
        if (particle.x <= 0 || particle.x >= canvas.width) particle.speedX *= -1;
        if (particle.y <= 0 || particle.y >= canvas.height) particle.speedY *= -1;
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
        
        // Draw connections
        particles.forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.1 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
          }
        });
      });
      
      requestAnimationFrame(animate);
    };
    
    animate();
    
    // Handle resize
    window.addEventListener('resize', () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
  }

  // Scroll Animations
  private initScrollAnimations(): void {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);
    
    // Observe all elements with data-aos attribute
    document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
  }
}