import { Timestamp } from '@angular/fire/firestore';

export interface Task {
  id: string;
  title: string;
  content?: string;
  startDate?: Date | Timestamp | null;
  dueDate?: Date | Timestamp | null;
  priority?: 'high' | 'medium' | 'low';
  status?: '未着手' | '進行中' | '完了';
  tag?: string;
  archived?: boolean;
  deleted?: boolean;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  archivedAt?: Date | Timestamp | null;
  deletedAt?: Date | Timestamp | null;
  imageUrl?: string | null;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  } | null;
  reminder?: boolean;
  assignedUser?: string | null;
  assignedUsers?: { email: string; displayName: string }[];
  ownerId: string;
  assignedUserIds?: string[];
} 