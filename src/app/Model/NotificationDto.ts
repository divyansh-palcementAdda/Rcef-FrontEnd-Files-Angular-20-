// src/app/notifications/notification.model.ts
// src/app/Model/NotificationDto.ts
export interface NotificationDto {
  id: number;
  taskId: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  username: string;
  title?: string;  // optional
}