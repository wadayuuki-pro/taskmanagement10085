export interface Message {
  id?: string;
  tagId: string;
  senderEmail: string;
  senderName: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  isRead?: boolean;
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
  replyTo?: string;
  replyToName?: string;
  mentions?: string[];
} 