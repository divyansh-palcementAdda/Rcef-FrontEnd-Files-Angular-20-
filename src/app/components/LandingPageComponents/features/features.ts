import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Feature {
  icon: string;
  title: string;
  description: string;
}
@Component({
  selector: 'app-features',
  imports: [],
  templateUrl: './features.html',
  styleUrl: './features.css'
})
export class Features {
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
}