import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-why-section',
  imports: [CommonModule],
  templateUrl: './why-section.html',
  styleUrl: './why-section.css'
})
export class WhySection {
benefits = signal<Benefit[]>([
    {
      icon: 'bot',
      title: 'Automation First',
      description: 'Let the system handle repetitive tasks. Automated reporting, smart task assignments, and intelligent workflows save hours every week. Focus on what matters while we handle the rest.'
    },
    {
      icon: 'eye',
      title: 'Crystal Clear Visibility',
      description: 'Know exactly what\'s happening across all teams and projects. Real-time dashboards, instant insights, and comprehensive reports keep everyone aligned and informed.'
    },
    {
      icon: 'gauge',
      title: 'Maximum Efficiency',
      description: 'Optimize team performance with data-driven insights. Identify bottlenecks, balance workloads, and accelerate delivery with intelligent analytics and recommendations.'
    }
  ]);
}