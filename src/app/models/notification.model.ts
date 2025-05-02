export interface Notification {
  id?: string;
  taskId: string;
  taskTitle: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  recipientName: string;
  type: 'assignment' | 'mention' | 'update';
  createdAt: Date;
  isRead: boolean;
} 