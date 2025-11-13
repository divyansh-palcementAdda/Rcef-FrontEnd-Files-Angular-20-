import { Injectable, OnDestroy, inject } from '@angular/core';
import { RxStomp, IMessage } from '@stomp/rx-stomp';
import { Subject, BehaviorSubject, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { NotificationDto } from '../Model/NotificationDto';
import { JwtService } from './jwt-service';
import { ToastService } from './ToastData';
import { environment } from '../environment/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private rxStomp = new RxStomp();
  private destroy$ = new Subject<void>();
  private initialized = false;   // <-- IMPORTANT

  public incoming$ = new Subject<NotificationDto>();
  public unread$ = new BehaviorSubject<NotificationDto[]>([]);

  private http = inject(HttpClient);
  private jwtService = inject(JwtService);
  private toastService = inject(ToastService);

  constructor() {
    // ❌ Do NOT call fetchUnread() or initWebSocket() here
    // They will be called AFTER login manually.
  }

  // --------------------------------------------------------------
  // 0. Exposed initializer — call this AFTER login success
  // --------------------------------------------------------------
  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log('%c[NotificationService] Initializing...', 'color:#03A9F4;font-weight:bold;');

    this.fetchUnread();
    this.initWebSocket();
  }

  // --------------------------------------------------------------
  // 1. Initialize WebSocket with JWT in query param
  // --------------------------------------------------------------
  private initWebSocket() {
    const token = this.jwtService.getAccessToken();

    console.log('%c[NotificationService] Starting WebSocket with token:', 'color:#4CAF50;font-weight:bold;', token);

    const stompHeaders: Record<string, string> = {};
    if (token) {
      stompHeaders['Authorization'] = `Bearer ${token}`;
    }

    const wsBaseUrl = environment.wsUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/websocket`;

    this.rxStomp.configure({
      webSocketFactory: () => {
        const url = token ? `${wsUrl}?access_token=${token}` : wsUrl;
        return new WebSocket(url);
      },
      connectHeaders: stompHeaders,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      // debug: (msg: string) => console.log('[STOMP]', ),
    });

    this.rxStomp.activate();

    this.rxStomp
      .watch('/user/queue/notifications')
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg: IMessage) => {
        const payload: NotificationDto = JSON.parse(msg.body);
        this.handleIncomingNotification(payload);
      });
  }

  // --------------------------------------------------------------
  // 2. Reconnect with new token (after refresh)
  // --------------------------------------------------------------
  reconnect() {
    console.log('%c[NotificationService] Reconnecting WebSocket...', 'color:#FFC107;font-weight:bold;');

    this.rxStomp.deactivate();

    setTimeout(() => this.initWebSocket(), 1000);
  }

  // --------------------------------------------------------------
  // 3. Handle incoming realtime notification
  // --------------------------------------------------------------
  private handleIncomingNotification(n: NotificationDto) {
    const title = n.title ?? 'New Notification';

    this.incoming$.next({ ...n, title });
    this.unread$.next([{ ...n, title, isRead: false }, ...this.unread$.value]);

    this.toastService.show({
      title,
      message: n.message,
      taskId: n.taskId,
    });

    this.playSound();
  }

  // --------------------------------------------------------------
  // 4. REST API calls (interceptor adds Authorization header)
  // --------------------------------------------------------------
  fetchUnread() {
    console.log('%c[NotificationService] Fetching unread notifications...', 'color:#009688;font-weight:bold;');

    this.http
      .get<NotificationDto[]>(`${environment.apiUrl}/notifications/unread`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          const mapped = list.map((i) => ({ ...i, title: i.title ?? 'Notification' }));
          this.unread$.next(mapped);

          console.log('%c[NotificationService] Unread loaded:', 'color:#8BC34A;font-weight:bold;', mapped);
        },
        error: (e) => console.error('fetchUnread error', e),
      });
  }

  markAsRead(id: number) {
    this.http
      .patch<void>(`${environment.apiUrl}/notifications/${id}/read`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.unread$.next(this.unread$.value.filter((n) => n.id !== id)),
        error: (e) => console.error('markAsRead error', e),
      });
  }

  markAllAsRead() {
    this.http
      .patch<void>(`${environment.apiUrl}/notifications/read-all`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.unread$.next([]),
        error: (e) => console.error('markAllAsRead error', e),
      });
  }

  playSound() {
    const audio = new Audio('assets/sounds/new-notification-3-398649.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }

  // --------------------------------------------------------------
  // 5. Cleanup
  // --------------------------------------------------------------
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.rxStomp.deactivate();
  }
}
