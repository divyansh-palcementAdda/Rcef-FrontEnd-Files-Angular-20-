import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { trigger, transition, useAnimation, query, stagger } from '@angular/animations';
import { BulletinBannerComponent } from '../../Shared/bulletin-banner/bulletin-banner';
import { ApiService } from '../../../Services/api-service';
import { AuthApiService } from '../../../Services/auth-api-service';
import { JwtService } from '../../../Services/jwt-service';
import { DashboardDto } from '../../../Model/DashboardDto';
import { fadeInUp } from '../../../Animations/fade-in-up.animation';

export interface TaskSegment {
  label: string;
  value: number;
  pct: number;
  color: string;
  glow: string;
  arcPath: string;
  /** stroke-dashoffset to position this segment — classic donut technique */
  dashOffset: number;
  /** arc length to draw for this segment (the visible portion) */
  dashArray: number;
  /** full circumference, used as the second dasharray value */
  circumference: number;
  /** rotation so SVG starts at 12-o'clock (applied via transform on the SVG element) */
  rotateDeg: number;
}

export interface BubbleItem {
  label: string;
  value: number;
  size: number;       // px diameter 32–90
  color: string;
  bg: string;
  icon: string;
  route: string;
  status: string;
}

@Component({
  selector: 'app-facultys-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, BulletinBannerComponent],
  animations: [
    trigger('fadeInUpStagger', [
      transition(':enter', [
        query(':enter', [
          stagger(80, [useAnimation(fadeInUp, { params: { time: '300ms' } })])
        ], { optional: true })
      ])
    ])
  ],
  templateUrl: './facultys-dashboard.html',
  styleUrls: ['./facultys-dashboard.css']
})
export class FacultysDashboard implements OnInit, OnDestroy {
  private dataSub?: Subscription;
  dashboardData?: DashboardDto;

  /** Segmented arc chart data */
  segments: TaskSegment[] = [];
  /** Bubble grid chart data */
  bubbles: BubbleItem[] = [];

  currentDate = new Date();

  // palette — project theme colors aligned with CSS variables
  private palette = [
    { color: '#4f46e5', glow: 'rgba(79,70,229,0.30)'   }, // Completed  → primary indigo
    { color: '#06b6d4', glow: 'rgba(6,182,212,0.30)'   }, // In Progress → info cyan
    { color: '#f59e0b', glow: 'rgba(245,158,11,0.30)'  }, // Pending    → warning amber
    { color: '#10b981', glow: 'rgba(16,185,129,0.30)'  }, // Upcoming   → success green
    { color: '#f43f5e', glow: 'rgba(244,63,94,0.30)'   }, // Delayed    → danger red
    { color: '#8b5cf6', glow: 'rgba(139,92,246,0.30)'  }, // Extended   → violet
  ];

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthApiService,
    private jwtService: JwtService
  ) {}

  ngOnInit(): void { this.loadDashboardData(); }
  ngOnDestroy(): void { this.dataSub?.unsubscribe(); }

  loadDashboardData(): void {
    this.dataSub = this.apiService.getDashboardData().subscribe({
      next: (data) => {
        if (data) {
          this.dashboardData = data;
          this.buildSegments(data);
          this.buildBubbles(data);
        }
      },
      error: (err) => console.error('Faculty dashboard error:', err)
    });
  }

  // ─── Segmented arc chart ─────────────────────────────────────────
  // Classic donut technique:
  //   - All circles share cx/cy/r; the <g> wrapper is rotated -90° so arc 0 = 12-o'clock
  //   - stroke-dasharray = [segmentLen, circumference] — draws only this segment's arc
  //   - stroke-dashoffset = -cumulativeArc — shifts the drawn portion to its start position
  //     (negative offset moves the dash forward along the path)
  private buildSegments(d: DashboardDto): void {
    const raw = [
      { label: 'Completed',   value: d.completedTask || 0 },
      { label: 'In Progress', value: d.activeTask    || 0 },
      { label: 'Pending',     value: d.pendingTask   || 0 },
      { label: 'Upcoming',    value: d.upcomingTask  || 0 },
      { label: 'Delayed',     value: d.delayedTask   || 0 },
      { label: 'Extended',    value: d.extendedTask  || 0 },
    ];
    const total = raw.reduce((s, x) => s + x.value, 0) || 1;

    const r = 78;
    const circumference = +(2 * Math.PI * r).toFixed(4); // ≈ 490.09

    // Gap between segments: 2° in arc-length units
    const GAP = (2 / 360) * circumference;

    let cumulativeArc = 0;

    this.segments = raw.map((item, i) => {
      const pct    = item.value / total;
      const arcLen = pct * circumference;

      // Visual length: subtract gap only if this segment has content
      // Use a half-gap on each side so gaps are centered between segments
      const drawLen = item.value > 0 ? Math.max(0, arcLen - GAP) : 0;

      // Negative dashoffset advances the start of the dash forward along the path.
      // cumulativeArc is how far around the circle we've already placed segments.
      const dashOffset = -cumulativeArc;

      cumulativeArc += arcLen;

      return {
        label:        item.label,
        value:        item.value,
        pct:          Math.round(pct * 100),
        color:        this.palette[i % this.palette.length].color,
        glow:         this.palette[i % this.palette.length].glow,
        arcPath:      '',
        dashArray:    +drawLen.toFixed(4),
        dashOffset:   +dashOffset.toFixed(4),
        circumference,
        rotateDeg:    -90,
      };
    });
  }

  // ─── Bubble grid chart ───────────────────────────────────────────
  private buildBubbles(d: DashboardDto): void {
    const items = [
      { label: 'Completed',   value: d.completedTask || 0, color: '#10b981', bg: '#ecfdf5', icon: 'bi-check2-circle',            route: '/view-tasks', status: 'CLOSED'      },
      { label: 'In Progress', value: d.activeTask    || 0, color: '#6366f1', bg: '#eeebff', icon: 'bi-play-circle-fill',          route: '/view-tasks', status: 'IN_PROGRESS' },
      { label: 'Pending',     value: d.pendingTask   || 0, color: '#f59e0b', bg: '#fffbeb', icon: 'bi-hourglass-split',           route: '/view-tasks', status: 'PENDING'     },
      { label: 'Delayed',     value: d.delayedTask   || 0, color: '#f43f5e', bg: '#fff1f2', icon: 'bi-exclamation-triangle-fill', route: '/view-tasks', status: 'DELAYED'     },
      { label: 'Upcoming',    value: d.upcomingTask  || 0, color: '#06b6d4', bg: '#ecfeff', icon: 'bi-calendar-event-fill',       route: '/view-tasks', status: 'UPCOMING'    },
      { label: 'Extended',    value: d.extendedTask  || 0, color: '#8b5cf6', bg: '#f5f3ff', icon: 'bi-arrow-repeat',              route: '/view-tasks', status: 'EXTENDED'    },
    ];
    const max = Math.max(...items.map(x => x.value));
    // If all zero, show uniform medium bubbles
    const effectiveMax = max > 0 ? max : 1;
    const allZero = max === 0;

    this.bubbles = items.map(item => ({
      ...item,
      // allZero → uniform 60px; otherwise 44–100px based on ratio
      size: allZero ? 60 : Math.round(44 + (item.value / effectiveMax) * 56),
    }));
  }

  getGreetingTime(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning ☀️';
    if (h < 17) return 'Good Afternoon 👋';
    return 'Good Evening 🌙';
  }

  calculatePerformance(): number {
    if (!this.dashboardData) return 0;
    const { completedTask = 0, totalTask = 0, delayedTask = 0, selfTask = 0 } = this.dashboardData;
    if (totalTask === 0) return 0;
    let p = Math.round((completedTask / totalTask) * 100);
    p = Math.max(0, Math.min(100, p - Math.min(delayedTask * 5, 30)));
    if (selfTask > 0) p = Math.min(100, p + selfTask * 2);
    return p;
  }

  getPerformanceStatus(): string {
    const p = this.calculatePerformance();
    if (p >= 80) return 'Excellent';
    if (p >= 60) return 'Good';
    if (p >= 40) return 'Average';
    return 'Needs Improvement';
  }

  getPerformanceColor(): string {
    const p = this.calculatePerformance();
    if (p >= 80) return 'great';
    if (p >= 60) return 'good';
    if (p >= 40) return 'avg';
    return 'low';
  }

  getRingOffset(): number {
    const circ = 2 * Math.PI * 46;
    return circ - (this.calculatePerformance() / 100) * circ;
  }

  goToPage(card: { route: string; queryParams?: Record<string, string> }): void {
    this.router.navigate([card.route], { queryParams: card.queryParams || {} });
  }

  getLegendStatus(label: string): string {
    const map: Record<string, string> = {
      'Completed':   'CLOSED',
      'In Progress': 'IN_PROGRESS',
      'Pending':     'PENDING',
      'Upcoming':    'UPCOMING',
      'Delayed':     'DELAYED',
      'Extended':    'EXTENDED',
    };
    return map[label] || '';
  }
}
