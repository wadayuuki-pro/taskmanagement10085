import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, DocumentReference, addDoc, getDocs } from '@angular/fire/firestore';
import { Observable, from, firstValueFrom, combineLatest } from 'rxjs';
import { Task } from '../models/task.model';
import { AuthService } from '../auth.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  private async getCurrentUserId(): Promise<string> {
    const user = await firstValueFrom(this.authService.getCurrentUser());
    console.log('現在のユーザー情報:', user);
    if (!user) {
      throw new Error('ユーザーがログインしていません');
    }
    return user.uid;
  }

  async getTasks(): Promise<Observable<Task[]>> {
    const userId = await this.getCurrentUserId();
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());
    console.log('現在のユーザーID:', userId);
    const tasksRef = collection(this.firestore, 'tasks');
    
    // まず、すべてのタスクを取得してデバッグ
    const allTasksQuery = query(tasksRef);
    const allTasksSnapshot = await getDocs(allTasksQuery);
    const allTasks = allTasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
    console.log('データベース内の全タスク:', allTasks);

    // クエリを単純化して、メモリ上でフィルタリング
    const baseQuery = query(
      tasksRef,
      orderBy('createdAt', 'desc')
    );

    return new Observable<Task[]>(observer => {
      collectionData(baseQuery, { idField: 'id' }).subscribe({
        next: async (tasks) => {
          // メモリ上でフィルタリング
          const filteredTasks = tasks.filter(task => {
            const taskData = task as Task;
            const isNotDeleted = !taskData.deleted;
            const isNotArchived = !taskData.archived;
            const isOwner = taskData.ownerId === userId;
            
            // assignedUserIdsとassignedUsersの両方をチェック
            const isAssignedById = taskData.assignedUserIds && taskData.assignedUserIds.includes(userId);
            const isAssignedByEmail = taskData.assignedUsers && 
              taskData.assignedUsers.some(user => user.email === (currentUser?.email || ''));
            
            return isNotDeleted && isNotArchived && (isOwner || isAssignedById || isAssignedByEmail);
          }) as Task[];
          
          console.log('フィルタリング後のタスク:', filteredTasks);
          observer.next(filteredTasks);
        },
        error: (error) => {
          console.error('タスクの取得中にエラーが発生しました:', error);
          observer.error(error);
        }
      });
    });
  }

  async getTasksWithDueDate(): Promise<Observable<Task[]>> {
    const userId = await this.getCurrentUserId();
    const tasksRef = collection(this.firestore, 'tasks');
    
    const baseQuery = query(
      tasksRef,
      orderBy('dueDate', 'asc')
    );

    return new Observable<Task[]>(observer => {
      collectionData(baseQuery, { idField: 'id' }).subscribe({
        next: (tasks) => {
          const filteredTasks = tasks.filter(task => {
            const taskData = task as Task;
            const isNotDeleted = !taskData.deleted;
            const isNotArchived = !taskData.archived;
            const isOwner = taskData.ownerId === userId;
            const isAssigned = taskData.assignedUserIds && taskData.assignedUserIds.includes(userId);
            const hasDueDate = taskData.dueDate !== null;
            
            return isNotDeleted && isNotArchived && hasDueDate && (isOwner || isAssigned);
          }) as Task[];
          
          console.log('期限付きタスクのフィルタリング結果:', filteredTasks);
          observer.next(filteredTasks);
        },
        error: (error) => {
          console.error('期限付きタスクの取得中にエラーが発生しました:', error);
          observer.error(error);
  }
      });
    });
  }

  async getReminderTasks(): Promise<Observable<Task[]>> {
    const userId = await this.getCurrentUserId();
    const tasksRef = collection(this.firestore, 'tasks');
    
    // クエリを単純化して、メモリ上でフィルタリング
    const baseQuery = query(
      tasksRef,
      orderBy('createdAt', 'desc')
    );

    return new Observable<Task[]>(observer => {
      collectionData(baseQuery, { idField: 'id' }).subscribe({
        next: (tasks) => {
          // メモリ上でフィルタリング
          const filteredTasks = tasks.filter(task => {
            const taskData = task as Task;
            const isNotDeleted = !taskData.deleted;
            const isNotArchived = !taskData.archived;
            const isOwner = taskData.ownerId === userId;
            const isAssigned = taskData.assignedUserIds && taskData.assignedUserIds.includes(userId);
            const hasReminder = taskData.reminder === true;
            
            return isNotDeleted && isNotArchived && hasReminder && (isOwner || isAssigned);
          }) as Task[];
          
          console.log('リマインダーフィルタリング後のタスク:', filteredTasks);
          observer.next(filteredTasks);
        },
        error: (error) => {
          console.error('リマインダータスクの取得中にエラーが発生しました:', error);
          observer.error(error);
  }
      });
    });
  }

  async getArchivedTasks(): Promise<Observable<Task[]>> {
    const userId = await this.getCurrentUserId();
    const tasksRef = collection(this.firestore, 'tasks');
    
    const baseQuery = query(
      tasksRef,
      orderBy('archivedAt', 'desc')
    );

    return new Observable<Task[]>(observer => {
      collectionData(baseQuery, { idField: 'id' }).subscribe({
        next: (tasks) => {
          const filteredTasks = tasks.filter(task => {
            const taskData = task as Task;
            const isNotDeleted = !taskData.deleted;
            const isArchived = taskData.archived === true;
            const isOwner = taskData.ownerId === userId;
            const isAssigned = taskData.assignedUserIds && taskData.assignedUserIds.includes(userId);
            
            return isNotDeleted && isArchived && (isOwner || isAssigned);
          }) as Task[];
          
          console.log('アーカイブタスクのフィルタリング結果:', filteredTasks);
          observer.next(filteredTasks);
        },
        error: (error) => {
          console.error('アーカイブタスクの取得中にエラーが発生しました:', error);
          observer.error(error);
  }
      });
    });
  }

  async getDeletedTasks(): Promise<Observable<Task[]>> {
    const userId = await this.getCurrentUserId();
    const tasksRef = collection(this.firestore, 'tasks');
    
    const baseQuery = query(
      tasksRef,
      orderBy('deletedAt', 'desc')
    );

    return new Observable<Task[]>(observer => {
      collectionData(baseQuery, { idField: 'id' }).subscribe({
        next: (tasks) => {
          const filteredTasks = tasks.filter(task => {
            const taskData = task as Task;
            const isDeleted = taskData.deleted === true;
            const isOwner = taskData.ownerId === userId;
            const isAssigned = taskData.assignedUserIds && taskData.assignedUserIds.includes(userId);
            
            return isDeleted && (isOwner || isAssigned);
          }) as Task[];
          
          console.log('削除済みタスクのフィルタリング結果:', filteredTasks);
          observer.next(filteredTasks);
        },
        error: (error) => {
          console.error('削除済みタスクの取得中にエラーが発生しました:', error);
          observer.error(error);
        }
      });
    });
  }

  getTasksToAutoDelete(): Promise<Task[]> {
    const tasksRef = collection(this.firestore, 'tasks');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const q = query(
      tasksRef,
      where('deleted', '==', true)
    );
    
    return new Promise((resolve, reject) => {
      getDocs(q).then(snapshot => {
        const tasks = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Task))
          .filter(task => {
            if (task.deletedAt && task.deletedAt instanceof Date) {
              return task.deletedAt < sevenDaysAgo;
            }
            return false;
          });
        resolve(tasks);
      }).catch(reject);
    });
  }

  autoDeleteOldTasks(): Promise<void> {
    return this.getTasksToAutoDelete().then(tasks => {
      const deletePromises = tasks.map(task => this.deleteTask(task.id));
      return Promise.all(deletePromises).then(() => {
        console.log(`${tasks.length}件のタスクを自動削除しました`);
      });
    });
  }

  async addTask(task: Partial<Task>): Promise<void> {
    const tasksRef = collection(this.firestore, 'tasks');
    const newTask = {
      ...task,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      deleted: false,
      archived: false,
      reminder: false
    };
    const docRef = await addDoc(tasksRef, newTask);
    console.log('タスクが追加されました。ID:', docRef.id);

    // 担当者が割り当てられている場合、通知を送信
    if (task.assignedUsers && task.assignedUsers.length > 0) {
      await this.sendAssignmentNotifications(docRef.id, task);
    }
  }

  private async sendAssignmentNotifications(taskId: string, task: Partial<Task>): Promise<void> {
    try {
      const currentUser = await firstValueFrom(this.authService.getCurrentUser());
      if (!currentUser) {
        console.error('ユーザーが認証されていません');
        return;
      }

      if (!task.assignedUsers || task.assignedUsers.length === 0) {
        console.log('担当者が割り当てられていないため、通知を送信しません');
        return;
      }

      const notificationsRef = collection(this.firestore, 'notifications');
      const notificationPromises = task.assignedUsers.map(async (assignedUser) => {
        if (!assignedUser.email) {
          console.error('担当者のメールアドレスが設定されていません:', assignedUser);
          return;
        }

        const notification = {
          taskId: taskId,
          taskTitle: task.title || '無題のタスク',
          senderEmail: currentUser.email || '',
          senderName: currentUser.displayName || '匿名',
          recipientEmail: assignedUser.email,
          recipientName: assignedUser.displayName || '匿名',
          type: 'assignment' as const,
          createdAt: Timestamp.now(),
          isRead: false
        };

        console.log('通知を作成します:', notification);
        await addDoc(notificationsRef, notification);
      });

      await Promise.all(notificationPromises);
      console.log('担当者への通知を送信しました');
    } catch (error) {
      console.error('通知の送信に失敗しました:', error);
    }
  }

  async updateTask(taskId: string, task: Partial<Task>): Promise<void> {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    const updatedTask = {
      ...task,
      updatedAt: Timestamp.now()
    };
    await updateDoc(taskRef, updatedTask);
    console.log('タスクが更新されました。ID:', taskId);

    // 担当者が変更された場合、通知を送信
    if (task.assignedUsers && task.assignedUsers.length > 0) {
      await this.sendAssignmentNotifications(taskId, task);
    }
  }

  archiveTask(taskId: string): Promise<void> {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    return updateDoc(taskRef, {
      archived: true,
      archivedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }

  restoreTask(taskId: string): Promise<void> {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    return updateDoc(taskRef, {
      archived: false,
      archivedAt: null,
      updatedAt: Timestamp.now()
    });
  }

  moveToTrash(taskId: string): Promise<void> {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    return updateDoc(taskRef, {
      deleted: true,
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }

  deleteTask(taskId: string): Promise<void> {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    return deleteDoc(taskRef);
  }

  toggleReminder(taskId: string, reminder: boolean): Promise<void> {
    const taskRef = doc(this.firestore, 'tasks', taskId);
    return updateDoc(taskRef, {
      reminder: reminder,
      updatedAt: Timestamp.now()
    });
  }

  // タグページ用のタスク取得メソッド
  async getTasksByTag(tagName: string): Promise<Observable<Task[]>> {
    const tasksRef = collection(this.firestore, 'tasks');
    
    // クエリを単純化して、メモリ上でフィルタリング
    const baseQuery = query(
      tasksRef,
      orderBy('createdAt', 'desc')
    );

    return new Observable<Task[]>(observer => {
      collectionData(baseQuery, { idField: 'id' }).subscribe({
        next: (tasks) => {
          // メモリ上でフィルタリング
          const filteredTasks = tasks.filter(task => {
            const taskData = task as Task;
            const isNotDeleted = !taskData.deleted;
            const isNotArchived = !taskData.archived;
            const hasMatchingTag = taskData.tag === tagName;
            
            return isNotDeleted && isNotArchived && hasMatchingTag;
          }) as Task[];
          
          console.log('タグページのフィルタリング後のタスク:', filteredTasks);
          observer.next(filteredTasks);
        },
        error: (error) => {
          console.error('タグページのタスク取得中にエラーが発生しました:', error);
          observer.error(error);
        }
      });
    });
  }
} 