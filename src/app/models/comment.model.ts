export interface Comment {
  id?: string;
  tagId: string;
  content: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: Date;
  updatedAt?: Date;
} 