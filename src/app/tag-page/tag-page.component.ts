import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { TaskService } from '../services/task.service';
import { Task } from '../models/task.model';
import { TaskCardComponent } from '../components/task-card/task-card.component';
import { OverlayService } from '../components/task-input/overlay.service';
import { GanttChartComponent } from '../components/gantt-chart/gantt-chart.component';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Timestamp, doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { CommentSectionComponent } from '../components/comment-section/comment-section.component';
import { AuthService } from '../auth.service';
import { User } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-tag-page',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    TaskCardComponent,
    CommentSectionComponent
  ],
  templateUrl: './tag-page.component.html',
  styleUrls: ['./tag-page.component.css']
})
export class TagPageComponent implements OnInit {
  tagName: string = '';
  tagId: string = '';  // タグIDを保持するプロパティを追加
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  searchQuery: string = '';
  assignedUsers: { email: string; displayName: string }[] = [];
  newUserEmail: string = '';
  showAssignDialog = false;  // ダイアログの表示状態
  currentUser: User | null = null;
  private overlay: Overlay;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskService,
    private overlayService: OverlayService,
    overlay: Overlay,
    private firestore: Firestore,
    private authService: AuthService
  ) {
    this.overlay = overlay;
    // 現在のユーザー情報を取得
    this.authService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
    });
  }

  async ngOnInit() {
    this.route.params.subscribe(async (params: Params) => {
      this.tagName = params['tagName'];
      await this.loadAssignedUsers();
      await this.loadTasks();
    });
  }

  async loadAssignedUsers() {
    // タグ名で検索して既存のタグを探す
    const tagCollectionRef = collection(this.firestore, 'tags');
    const tagQuery = query(tagCollectionRef, where('name', '==', this.tagName));
    const tagSnapshot = await getDocs(tagQuery);
    
    if (!tagSnapshot.empty) {
      const data = tagSnapshot.docs[0].data();
      this.assignedUsers = data['assignedUsers'] || [];
      this.tagId = tagSnapshot.docs[0].id;  // タグIDを保存
      console.log('タグが見つかりました。tagId:', this.tagId);
    } else {
      this.assignedUsers = [];
      this.tagId = '';  // タグが存在しない場合は空文字を設定
      console.log('タグが見つかりませんでした。tagId:', this.tagId);
      
      // タグが存在しない場合、現在のユーザーを自動的にアサイン
      if (this.currentUser && this.currentUser.email) {
        await this.autoAssignCurrentUser();
      }
    }
  }

  // 現在のユーザーを自動的にアサインする
  async autoAssignCurrentUser() {
    console.log('autoAssignCurrentUser called');
    try {
      if (!this.currentUser || !this.currentUser.email) return;
      
      const userEmail = this.currentUser.email;
      const tagCollectionRef = collection(this.firestore, 'tags');
      const tagQuery = query(tagCollectionRef, where('name', '==', this.tagName));
      const tagSnapshot = await getDocs(tagQuery);
      
      let tagRef;
      if (!tagSnapshot.empty) {
        // 既存のタグを使用
        tagRef = doc(this.firestore, 'tags', tagSnapshot.docs[0].id);
        this.tagId = tagSnapshot.docs[0].id;
        const data = tagSnapshot.docs[0].data();
        const users = data['assignedUsers'] || [];
        const userIds = data['assignedUserIds'] || [];
        
        // 既にアサインされているかチェック
        const isAlreadyAssigned = users.some((user: any) => user.email === userEmail);
        if (!isAlreadyAssigned) {
          users.push({ email: userEmail, displayName: this.currentUser.displayName });
          userIds.push(this.currentUser.uid);
          await updateDoc(tagRef, { 
            assignedUsers: users,
            assignedUserIds: userIds
          });
        }
      } else {
        // 新規タグを作成
        const user = await firstValueFrom(this.authService.getCurrentUser());
        if (!user) {
          alert('ユーザー情報が取得できません。再ログインしてください。');
          return;
        }
        const uid = user.uid;
        
        const newTag = {
          name: this.tagName,
          assignedUsers: [{ email: userEmail, displayName: this.currentUser.displayName }],
          assignedUserIds: [uid],
          createdAt: new Date(),
          order: 0,
          ownerId: uid
        };
        
        const newTagRef = await addDoc(tagCollectionRef, newTag);
        tagRef = newTagRef;
        this.tagId = newTagRef.id;
      }
      
      // アサインされたユーザーを更新
      const tagDoc = await getDoc(tagRef);
      if (tagDoc.exists()) {
        const data = tagDoc.data();
        this.assignedUsers = data['assignedUsers'] || [];
      }
    } catch (error) {
      console.error('autoAssignCurrentUser error:', error);
    }
  }

  // アサインダイアログを開く
  openAssignDialog(): void {
    this.showAssignDialog = true;
    this.newUserEmail = '';
  }

  // アサインダイアログを閉じる
  closeAssignDialog(): void {
    this.showAssignDialog = false;
    this.newUserEmail = '';
  }

  // アサイン処理を修正
  async assignUser(): Promise<void> {
    console.log('assignUser called');
    try {
      if (!this.newUserEmail.trim()) return;
    
    // まず、タグ名で検索して既存のタグを探す
    const tagCollectionRef = collection(this.firestore, 'tags');
    const tagQuery = query(tagCollectionRef, where('name', '==', this.tagName));
    const tagSnapshot = await getDocs(tagQuery);
        
      // 新しくアサインするユーザーのUIDを取得
      const usersCollectionRef = collection(this.firestore, 'users');
      const userQuery = query(usersCollectionRef, where('email', '==', this.newUserEmail));
      const userSnapshot = await getDocs(userQuery);
      let newUserId = '';
      if (!userSnapshot.empty) {
        newUserId = userSnapshot.docs[0].id;
      }
    
    let tagRef;
    if (!tagSnapshot.empty) {
      // 既存のタグを使用
      tagRef = doc(this.firestore, 'tags', tagSnapshot.docs[0].id);
      const data = tagSnapshot.docs[0].data();
      const users = data['assignedUsers'] || [];
        const userIds = data['assignedUserIds'] || [];
        
        // ユーザー情報を追加
        users.push({ email: this.newUserEmail, displayName: this.currentUser?.displayName || '' });
        
        // UIDが取得できた場合のみassignedUserIdsに追加
        if (newUserId) {
          userIds.push(newUserId);
        }
        
        await updateDoc(tagRef, { 
          assignedUsers: users,
          assignedUserIds: userIds
        });
    } else {
      // 新規タグを作成
        const user = await firstValueFrom(this.authService.getCurrentUser());
        if (!user) {
          alert('ユーザー情報が取得できません。再ログインしてください。');
          return;
        }
        const uid = user.uid;
        console.log('タグ作成時のuid:', uid);
        
      const newTag = {
        name: this.tagName,
          assignedUsers: [{ email: this.newUserEmail, displayName: this.currentUser?.displayName || '' }],
          assignedUserIds: newUserId ? [uid, newUserId] : [uid],
        createdAt: new Date(),
          order: 0,
          ownerId: uid
      };
        console.log('Firestoreに保存するnewTag:', JSON.stringify(newTag));
      const newTagRef = await addDoc(tagCollectionRef, newTag);
        const savedDoc = await getDoc(newTagRef);
        console.log('Firestoreに保存されたドキュメント:', savedDoc.data());
      tagRef = newTagRef;
        this.tagId = newTagRef.id;
    }
    
      // アサインされたユーザーを更新
      const tagDoc = await getDoc(tagRef);
      if (tagDoc.exists()) {
        const data = tagDoc.data();
        this.assignedUsers = data['assignedUsers'] || [];
      }
      
      // ダイアログを閉じてフォームをリセット
    this.closeAssignDialog();
    } catch (error) {
      console.error('assignUser error:', error);
      alert('ユーザーのアサインに失敗しました。');
    }
  }

  async removeUser(index: number) {
    try {
      const userToRemove = this.assignedUsers[index];
      
      // タグの参照を取得
      const tagRef = doc(this.firestore, 'tags', this.tagId);
      const tagDoc = await getDoc(tagRef);
    
      if (tagDoc.exists()) {
        const data = tagDoc.data();
      const users = data['assignedUsers'] || [];
        const userIds = data['assignedUserIds'] || [];
        
        // 削除するユーザーのUIDを取得
        const usersCollectionRef = collection(this.firestore, 'users');
        const userQuery = query(usersCollectionRef, where('email', '==', userToRemove.email));
        const userSnapshot = await getDocs(userQuery);
        
        // assignedUsersから削除
        const updatedUsers = users.filter((user: any) => user.email !== userToRemove.email);
        
        // assignedUserIdsから削除（UIDが見つかった場合）
        let updatedUserIds = userIds;
        if (!userSnapshot.empty) {
          const userIdToRemove = userSnapshot.docs[0].id;
          updatedUserIds = userIds.filter((id: string) => id !== userIdToRemove);
    }
    
        // 更新を実行
        await updateDoc(tagRef, {
          assignedUsers: updatedUsers,
          assignedUserIds: updatedUserIds
        });
        
        // ローカルの状態を更新
        this.assignedUsers = updatedUsers;
      }
    } catch (error) {
      console.error('ユーザー削除エラー:', error);
      alert('ユーザーの削除に失敗しました。');
  }
  }

  async loadTasks(): Promise<void> {
    const tasksObservable = await this.taskService.getTasksByTag(this.tagName);
    tasksObservable.subscribe(tasks => {
      this.tasks = tasks;
      this.filteredTasks = this.tasks;
    });
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredTasks = this.tasks;
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredTasks = this.tasks.filter(task => {
      return (
        (task.title?.toLowerCase().includes(query)) ||
        (task.content?.toLowerCase().includes(query))
      );
    });
  }

  addTask(): void {
    console.log('タスク追加: タグ名', this.tagName);
    console.log('タスク追加: 担当者リスト', this.assignedUsers);
    
    this.overlayService.openTaskInput({
      tag: this.tagName,
      title: '',
      content: '',
      startDate: null,
      dueDate: null,
      priority: 'medium',
      status: '未着手',
      assignedUsers: this.assignedUsers,  // タグに割り当てられた全ユーザーを渡す
      showAssigneeSection: true,  // 担当者選択セクションを表示
      isTagPage: true
    }, true);
  }

  editTask(task: Task): void {
    const taskData = {
      id: task.id,
      title: task.title,
      content: task.content || '',
      startDate: task.startDate,
      dueDate: task.dueDate,
      priority: task.priority || 'medium',
      status: task.status || '未着手',
      tag: task.tag || '',
      imageUrl: task.imageUrl,
      location: task.location,
      assignedUser: task.assignedUser || '',
      assignedUsers: task.assignedUsers || this.assignedUsers,  // 既存の担当者情報を使用
      showAssigneeSection: true,
      isTagPage: true
    };
    this.overlayService.openTaskInput(taskData, true);
  }

  onDeleteTask(taskId: string): void {
    if (confirm('このタスクを削除しますか？')) {
      this.taskService.moveToTrash(taskId)
        .then(() => {
          this.loadTasks();
        })
        .catch(error => {
          console.error('タスクの削除に失敗しました:', error);
          alert('タスクの削除に失敗しました');
        });
    }
  }

  onArchiveTask(taskId: string): void {
    this.taskService.archiveTask(taskId)
      .then(() => {
        this.loadTasks();
      })
      .catch(error => {
        console.error('タスクのアーカイブに失敗しました:', error);
        alert('タスクのアーカイブに失敗しました');
      });
  }

  showGanttChart(): void {
    const overlayRef = this.overlay.create({
      hasBackdrop: true,
      positionStrategy: this.overlay.position()
        .global()
        .centerHorizontally()
        .centerVertically()
    });

    const portal = new ComponentPortal(GanttChartComponent);
    const componentRef = overlayRef.attach(portal);
    componentRef.instance.tagName = this.tagName;
    componentRef.instance.tasks = this.tasks;

    // 閉じるボタンのイベントを購読
    componentRef.instance.close.subscribe(() => {
      overlayRef.dispose();
    });

    // バックドロップクリック時の処理
    overlayRef.backdropClick().subscribe(() => {
      overlayRef.dispose();
    });
  }
}
