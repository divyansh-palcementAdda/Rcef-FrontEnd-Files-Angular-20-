// src/app/services/notification.service.ts
import { Injectable, OnDestroy, inject } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { IMessage } from '@stomp/stompjs';
import { Subject, BehaviorSubject, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/environment';
import { NotificationDto } from '../Model/NotificationDto';
import { AuthApiService } from './auth-api-service';
import { ToastService } from './ToastData';


@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private rxStomp = new RxStomp();
  private destroy$ = new Subject<void>();
  private initialized = false;

  public incoming$ = new Subject<NotificationDto>();
  public unread$ = new BehaviorSubject<NotificationDto[]>([]);

  private http = inject(HttpClient);
  private authService = inject(AuthApiService);
  private toastService = inject(ToastService);

  // --------------------------------------------------------------
  // 0. Initialize AFTER login
  // --------------------------------------------------------------
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    console.log('%c[NotificationService] Initializing...', 'color:#03A9F4;font-weight:bold;');
    this.fetchUnread();
    this.connectWebSocket();
  }

  // --------------------------------------------------------------
  // 1. Connect WebSocket with JWT in HEADER
  // --------------------------------------------------------------
  private connectWebSocket(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn('[NotificationService] No token, skipping WebSocket');
      return;
    }

    console.log('%c[NotificationService] Connecting WebSocket...', 'color:#4CAF50;font-weight:bold;');

    const wsUrl = environment.wsUrl.replace(/^http/, 'ws') + '/ws-notifications';

    this.rxStomp.configure({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: 5000,
      debug: (str: string) => console.log('[STOMP]', str),
    });

    this.rxStomp.activate();

    // Subscribe using .watch() — RxJS Observable
    this.rxStomp
      .watch('/user/queue/notifications')
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: IMessage) => {
        try {
          const payload: NotificationDto = JSON.parse(message.body);
          this.handleIncomingNotification(payload);
        } catch (e) {
          console.error('Failed to parse notification:', e);
        }
      });
  }

  // --------------------------------------------------------------
  // 2. Reconnect with new token
  // --------------------------------------------------------------
  reconnect(): void {
    console.log('%c[NotificationService] Reconnecting WebSocket...', 'color:#FFC107;font-weight:bold;');
    this.rxStomp.deactivate({ force: true });
    setTimeout(() => this.connectWebSocket(), 1000);
  }

  // --------------------------------------------------------------
  // 3. Handle incoming notification
  // --------------------------------------------------------------
  private handleIncomingNotification(n: NotificationDto): void {
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
  // 4. REST: Fetch unread
  // --------------------------------------------------------------
  fetchUnread(): void {
    console.log('%c[NotificationService] Fetching unread...', 'color:#009688;font-weight:bold;');

    this.http
      .get<NotificationDto[]>(`${environment.apiUrl}/notifications/unread`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          const mapped = list.map((i) => ({ ...i, title: i.title ?? 'Notification' }));
          this.unread$.next(mapped);
          console.log('%c[NotificationService] Unread loaded:', 'color:#8BC34A;font-weight:bold;', mapped);
        },
        error: (err) => console.error('[NotificationService] fetchUnread error:', err),
      });
  }

  // --------------------------------------------------------------
  // 5. Mark as read
  // --------------------------------------------------------------
  markAsRead(id: number): void {
    this.http
      .patch<void>(`${environment.apiUrl}/notifications/${id}/read`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.unread$.next(this.unread$.value.filter((n) => n.id !== id));
        },
        error: (err) => console.error('[NotificationService] markAsRead error:', err),
      });
  }

  markAllAsRead(): void {
    this.http
      .patch<void>(`${environment.apiUrl}/notifications/read-all`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.unread$.next([]),
        error: (err) => console.error('[NotificationService] markAllAsRead error:', err),
      });
  }

  // --------------------------------------------------------------
  // 6. Play sound
  // --------------------------------------------------------------
  private playSound(): void {
    const audio = new Audio('assets/sounds/new-notification.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }

  // --------------------------------------------------------------
  // 7. Cleanup
  // --------------------------------------------------------------
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.rxStomp.deactivate({ force: true });
  }
}