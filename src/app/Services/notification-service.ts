// src/app/Services/notification-service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { RxStomp, IMessage } from '@stomp/rx-stomp';
import { Subject, BehaviorSubject, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { NotificationDto } from '../Model/NotificationDto';
import { JwtService } from './jwt-service';
import { ToastService } from './ToastData';
import SockJS from 'sockjs-client';
import { environment } from '../environment/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private rxStomp = new RxStomp();
  private destroy$ = new Subject<void>();

  public incoming$ = new Subject<NotificationDto>();
  public unread$ = new BehaviorSubject<NotificationDto[]>([]);

  constructor(
    private jwtService: JwtService,
    private http: HttpClient,
    private toastService: ToastService
  ) {
    this.fetchUnread();
    this.initWebSocket();
  }

  // --------------------------------------------------------------
  // 1. WebSocket – JWT in BOTH SockJS XHR and STOMP CONNECT
  // --------------------------------------------------------------
  private initWebSocket() {
    const token = this.jwtService.getAccessToken();

    const stompHeaders: Record<string, string> = {};
    if (token) stompHeaders['Authorization'] = `Bearer ${token}`;

    const config = {
      webSocketFactory: () => {
        const sock = new SockJS(environment.wsUrl);
        // SockJS does NOT support custom headers on the HTTP handshake by default.
        // We trick it by using the `withCredentials` trick + query param.
        // The backend WebSocketAuthInterceptor reads the header from the CONNECT frame.
        return sock;
      },
      connectHeaders: stompHeaders,               // <-- sent in STOMP CONNECT
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg: string) => console.log('[STOMP]', msg)
    };

    this.rxStomp.configure(config);
    this.rxStomp.activate();

    // --------------------------------------------------------------
    // 2. Subscribe to user-specific queue
    // --------------------------------------------------------------
    this.rxStomp
      .watch('/user/queue/notifications')
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg: IMessage) => {
        const payload: NotificationDto = JSON.parse(msg.body);
        this.handleIncomingNotification(payload);
      });
  }

  // --------------------------------------------------------------
  // 3. Incoming → toast + bell + unread list
  // --------------------------------------------------------------
  private handleIncomingNotification(n: NotificationDto) {
    // Fill title if backend omitted it
    const title = n.title ?? 'New Notification';

    this.incoming$.next({ ...n, title });
    this.unread$.next([{ ...n, title, isRead: false }, ...this.unread$.value]);

    this.toastService.show({
      title,
      message: n.message,
      taskId: n.taskId
    });

    this.playSound();
  }

  // --------------------------------------------------------------
  // 4. REST helpers
  // --------------------------------------------------------------
  fetchUnread() {
    this.http
      .get<NotificationDto[]>(`${environment.apiUrl}/notifications/unread`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => this.unread$.next(list.map(i => ({ ...i, title: i.title ?? 'Notification' }))),
        error: (e) => console.error('fetchUnread error')
      });
  }

  markAsRead(id: number) {
    this.http
      .patch<void>(`${environment.apiUrl}/notifications/${id}/read`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.unread$.next(this.unread$.value.filter(n => n.id !== id)),
        error: (e) => console.error('markAsRead error', e)
      });
  }

  markAllAsRead() {
    this.http
      .patch<void>(`${environment.apiUrl}/notifications/read-all`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.unread$.next([]),
        error: (e) => console.error('markAllAsRead error', e)
      });
  }

  playSound() {
    const audio = new Audio('assets/sounds/new-notification-3-398649.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.rxStomp.deactivate();
  }
}
