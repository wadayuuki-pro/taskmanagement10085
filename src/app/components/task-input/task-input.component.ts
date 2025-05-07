import { Firestore, collection, addDoc, doc, setDoc, query, where, getDocs, getDoc } from '@angular/fire/firestore'; //最新版
import { inject, Component, Input, OnInit, Optional, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { OverlayModule } from '@angular/cdk/overlay';
import { OverlayService } from './overlay.service';
import { InjectionToken } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GoogleDriveService } from '../../services/google-drive.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { TaskService } from '../../services/task.service';
import { MatDialog } from '@angular/material/dialog';
import { AuthDialogComponent } from '../auth-dialog/auth-dialog.component';
import { Timestamp } from '@angular/fire/firestore';
import { TagService } from '../../services/tag.service';
import { AuthService } from '../../auth.service';
import { User } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../../pages/tags/tag.service';
import { MatError } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

interface Task {
  id?: string;
  title: string;
  content: string;
  startDate: Date | null;
  dueDate: Date | null;
  priority: 'low' | 'medium' | 'high';
  status: '未着手' | '進行中' | '完了';
  createdAt: Date;
  imageUrl?: string;
  assignedUser?: string;
  showAssigneeSection?: boolean;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export const TASK_DATA = new InjectionToken<Task>('TASK_DATA');

@Component({
  selector: 'app-task-input',
  standalone: true,
  imports: [
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    CommonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule,
    MatError
  ],
  templateUrl: './task-input.component.html',
  styleUrls: ['./task-input.component.css'],
  providers: [MatDatepickerModule, TagService]
})
export class TaskInputComponent implements OnInit {
  @Input() taskToEdit?: any;
  @Input() assignedUsers: { email: string; displayName: string }[] = [];
  @Input() showAssigneeSection: boolean = false;
  @Input() isTagPage: boolean = false;

  currentUser: User | null = null;
  id?: string;
  tagNames = '';
  title = '';
  content = '';
  startDate: Date | null = null;
  dueDate: Date | null = null;
  selectedHour = 0;
  selectedMinute = 0;
  hours = Array.from({length: 24}, (_, i) => i);
  minutes = Array.from({length: 12}, (_, i) => i * 5);
  priority: 'high' | 'medium' | 'low' = 'medium';
  status: '未着手' | '進行中' | '完了' = '未着手';
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  imageUrl: string | null = null;
  imageFile: File | null = null;
  public assignedUser: string = '';
  public selectedAssignedUsers: string[] = [];
  public isEditMode: boolean = false;
  dateError: string | null = null;
  address: string = '';

  private firestore = inject(Firestore);
  private taskService = inject(TaskService);
  private googleDriveService = inject(GoogleDriveService);
  private googleAuthService = inject(GoogleAuthService);
  private dialog = inject(MatDialog);
  private overlayService = inject(OverlayService);
  private tagService = inject(TagService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  constructor(
    @Optional() @Inject(TASK_DATA) public injectedTaskData: any
  ) {
    if (this.injectedTaskData) {
      this.id = this.injectedTaskData.id;
      this.isEditMode = true;
      console.log('TaskInputComponent: 編集モードで初期化', this.injectedTaskData);
    } else {
      this.isEditMode = false;
      console.log('TaskInputComponent: 新規作成モードで初期化');
    }
  }

  ngOnInit() {
    // 現在のユーザーを取得
    this.authService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      if (user) {
        // ホームページでの新規作成時は、ログインユーザーを自動的に担当者として設定
        if (!this.isTagPage && !this.taskToEdit) {
          this.showAssigneeSection = true;
          this.assignedUsers = [{
            email: user.email || '',
            displayName: user.displayName || user.email || ''
          }];
          this.selectedAssignedUsers = [user.email || ''];
        }
      }
    });

    if (this.isEditMode) {
      console.log('TaskInputComponent: 編集モードでタスクデータを処理します', this.injectedTaskData);
      
      this.title = this.injectedTaskData.title || '';
      this.content = this.injectedTaskData.content || '';
      this.isTagPage = this.injectedTaskData.isTagPage || false;
      
      // locationデータの読み込み
      if (this.injectedTaskData.location) {
        this.address = this.injectedTaskData.location.address || '';
      }
      
      // FirestoreのTimestamp型をDate型に変換
      if (this.injectedTaskData.startDate && this.injectedTaskData.startDate.toDate) {
        this.startDate = this.injectedTaskData.startDate.toDate();
      } else if (this.injectedTaskData.startDate) {
        this.startDate = new Date(this.injectedTaskData.startDate);
      } else {
        this.startDate = null;
      }
      
      if (this.injectedTaskData.dueDate && this.injectedTaskData.dueDate.toDate) {
        const dueDate = this.injectedTaskData.dueDate.toDate();
        this.dueDate = dueDate;
        this.selectedHour = dueDate.getHours();
        this.selectedMinute = dueDate.getMinutes();
      } else if (this.injectedTaskData.dueDate) {
        const dueDate = new Date(this.injectedTaskData.dueDate);
        this.dueDate = dueDate;
        this.selectedHour = dueDate.getHours();
        this.selectedMinute = dueDate.getMinutes();
      } else {
        this.dueDate = null;
        this.selectedHour = 0;
        this.selectedMinute = 0;
      }
      
      this.priority = this.injectedTaskData.priority || 'medium';
      this.status = this.injectedTaskData.status || '未着手';
      this.tagNames = this.injectedTaskData.tag || '';
      
      // 画像URLの処理を改善
      if (this.injectedTaskData.imageUrl) {
        const fileId = this.extractFileId(this.injectedTaskData.imageUrl);
        if (fileId) {
          // Google Driveの画像URLを直接表示用に変換
          this.imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        } else {
          this.imageUrl = this.injectedTaskData.imageUrl;
        }
      } else {
        this.imageUrl = null;
      }
      
      // 担当者セクションの表示制御を修正
      if (this.injectedTaskData.assignedUsers && this.injectedTaskData.assignedUsers.length > 0) {
        this.showAssigneeSection = true;
        if (Array.isArray(this.injectedTaskData.assignedUsers)) {
          this.selectedAssignedUsers = this.injectedTaskData.assignedUsers.map((user: { email: string; displayName: string }) => user.email);
          this.assignedUsers = this.injectedTaskData.assignedUsers;
        } else {
          const users = Object.values(this.injectedTaskData.assignedUsers) as { email: string; displayName: string }[];
          this.selectedAssignedUsers = users.map(user => user.email);
          this.assignedUsers = users;
        }
      } else {
        this.showAssigneeSection = true;
        if (this.currentUser) {
          this.assignedUsers = [{
            email: this.currentUser.email || '',
            displayName: this.currentUser.displayName || this.currentUser.email || ''
          }];
          this.selectedAssignedUsers = [this.currentUser.email || ''];
        }
      }
      
      console.log('TaskInputComponent: 処理後のデータ', {
        title: this.title,
        content: this.content,
        startDate: this.startDate,
        dueDate: this.dueDate,
        priority: this.priority,
        status: this.status,
        tagNames: this.tagNames,
        imageUrl: this.imageUrl,
        showAssigneeSection: this.showAssigneeSection,
        selectedAssignedUsers: this.selectedAssignedUsers,
        assignedUsers: this.assignedUsers
      });

      // 編集時はタグにアサインされているユーザーを取得
      if (this.tagNames) {
        this.loadAssignedUsers();
      }
    } else {
      // 新規作成時の処理
      this.showAssigneeSection = true;
      if (this.isTagPage) {
        // タグページからの新規作成時は担当者セクションを表示
        this.loadAssignedUsers();
        // 新規作成時は担当者を選択していない状態にする
        this.selectedAssignedUsers = [];
      } else if (this.currentUser) {
        // ホームページからの新規作成時はログインユーザーを自動的に担当者として設定
        this.assignedUsers = [{
          email: this.currentUser.email || '',
          displayName: this.currentUser.displayName || this.currentUser.email || ''
        }];
        this.selectedAssignedUsers = [this.currentUser.email || ''];
      }
    }
  }

  // プロジェクトにアサインされているユーザーを取得するメソッドを追加
  async loadAssignedUsers() {
    try {
      if (!this.tagNames) {
        console.log('タグ名が設定されていません');
        return;
      }

      console.log('タグ名で担当者を検索:', this.tagNames);
      
      // タグ名で検索して既存のタグを探す
      const tagCollectionRef = collection(this.firestore, 'tags');
      const tagQuery = query(tagCollectionRef, where('name', '==', this.tagNames));
      const tagSnapshot = await getDocs(tagQuery);
      
      if (!tagSnapshot.empty) {
        const data = tagSnapshot.docs[0].data();
        const users = data['assignedUsers'] || [];
        const userIds = data['assignedUserIds'] || [];
        console.log('取得した担当者:', users);
        
        // ユーザー情報を正しく設定
        const updatedUsers = await Promise.all(users.map(async (user: { email: string; displayName: string }) => {
          // ユーザーのdisplayNameが設定されていない場合、Firestoreから取得
          if (!user.displayName || user.displayName === 'ユーザー') {
            // メールアドレスでユーザーを検索
            const usersCollectionRef = collection(this.firestore, 'users');
            const userQuery = query(usersCollectionRef, where('email', '==', user.email));
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
              const userData = userSnapshot.docs[0].data();
              return {
                email: user.email,
                displayName: userData['displayName'] || user.email
              };
            }
          }
          return user;
        }));

        if (this.isEditMode) {
          // 編集時は既存の担当者情報を保持
          this.assignedUsers = updatedUsers;
          console.log('編集モード: 担当者を設定', this.assignedUsers);
        } else {
          // 新規作成時は担当者リストのみを設定（選択はしない）
          this.assignedUsers = updatedUsers;
          this.selectedAssignedUsers = [];
          console.log('新規作成モード: 担当者リストを設定', this.assignedUsers);
        }
      } else {
        console.log('タグが見つかりませんでした');
      }
    } catch (error) {
      console.error('担当者情報の取得に失敗しました:', error);
    }
  }

  // タグ名が変更されたときに呼び出されるメソッド
  onTagChange() {
    this.loadAssignedUsers();
  }

  setStatus(newStatus: '未着手' | '進行中' | '完了') {
    this.status = newStatus;
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedImage = file;
      
      // プレビューを表示
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
        // 新しい画像が選択されたら、既存の画像URLをクリア
        this.imageUrl = null;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.selectedImage = null;
    this.imagePreview = null;
    this.imageUrl = null;
  }

  async handleImageUpload(taskId: string): Promise<string | null> {
    if (!this.selectedImage) {
      return null;
    }

    try {
      console.log('画像アップロードを開始します');
      
      // アクセストークンを取得
      const accessToken = this.googleAuthService.getAccessToken();
      if (!accessToken) {
        console.log('アクセストークンがないため、認証を要求します');
        
        // アクセストークンがない場合は認証を要求
        this.googleAuthService.requestAccessToken();
        
        // 認証ダイアログを表示
        const dialogRef = this.dialog.open(AuthDialogComponent, {
          width: '400px',
          data: { message: 'Google Driveへのアクセス許可が必要です。認証が完了したら、もう一度保存ボタンをクリックしてください。' }
        });
        
        await dialogRef.afterClosed().toPromise();
        console.log('認証ダイアログが閉じられました');
        return null;
      }
      
      console.log('アクセストークンが取得できました。画像をアップロードします');
      const imageUrl = await this.googleDriveService.uploadFile(this.selectedImage, taskId);
      console.log('画像のアップロードが完了しました:', imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('画像のアップロードに失敗しました:', error);
      throw error;
    }
  }

  async saveTask() {
    if (!this.validateDates()) {
      this.snackBar.open('締切日は開始日以降の日付を選択してください', '閉じる', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['error-snackbar']
      });
      return;
    }

    try {
      if (!this.currentUser) {
        console.error('ユーザーが認証されていません');
        return;
      }

      // タグが指定されている場合、タグの存在確認と作成を行う
      if (this.tagNames) {
        try {
          // まずタグ名で検索を試みる
          const tagCollectionRef = collection(this.firestore, 'tags');
          const tagQuery = query(tagCollectionRef, where('name', '==', this.tagNames));
          const tagSnapshot = await getDocs(tagQuery);
          
          if (tagSnapshot.empty) {
            // タグ名で見つからない場合、IDで検索を試みる
            const tagRef = doc(this.firestore, 'tags', this.tagNames);
            const tagDoc = await getDoc(tagRef);
            
            if (!tagDoc.exists()) {
              // タグが存在しない場合のみ、新規作成
              const newTag = {
                name: this.tagNames,
                assignedUsers: [{ email: this.currentUser.email || '', displayName: this.currentUser.displayName || 'ユーザー' }],
                assignedUserIds: [this.currentUser.uid],
                createdAt: Timestamp.now(),
                order: 0,
                ownerId: this.currentUser.uid
              };
              
              await setDoc(tagRef, newTag);
              console.log('新規タグを作成しました:', this.tagNames);
            } else {
              console.log('同じ名前のタグが既に存在します:', this.tagNames);
            }
          } else {
            console.log('同じ名前のタグが既に存在します:', this.tagNames);
          }
        } catch (error) {
          console.error('タグの作成に失敗しました:', error);
          throw error;
        }
      }

      // 画像の処理
      let finalImageUrl = this.imageUrl;
      if (this.selectedImage) {
        // 新規画像が選択されている場合
        const taskId = this.id || crypto.randomUUID();
        const uploadedImageUrl = await this.handleImageUpload(taskId);
        if (uploadedImageUrl) {
          finalImageUrl = uploadedImageUrl;
        }
      } else if (!this.imageUrl && this.id) {
        // 既存のタスクで画像が削除された場合
        finalImageUrl = null;
      }

      // 締め切り日時を設定
      let finalDueDate = null;
      if (this.dueDate) {
        const dueDate = new Date(this.dueDate);
        dueDate.setHours(this.selectedHour, this.selectedMinute, 0, 0);
        finalDueDate = dueDate;
      }

      const taskData = {
        title: this.title,
        content: this.content,
        startDate: this.startDate ? Timestamp.fromDate(this.startDate) : null,
        dueDate: finalDueDate ? Timestamp.fromDate(finalDueDate) : null,
        priority: this.priority,
        status: this.status,
        tag: this.tagNames,
        createdAt: this.id ? (this.injectedTaskData.createdAt || Timestamp.now()) : Timestamp.now(),
        updatedAt: Timestamp.now(),
        ownerId: this.currentUser.uid,
        imageUrl: finalImageUrl,
        assignedUsers: this.selectedAssignedUsers.map(email => ({
          email: email,
          displayName: this.getSelectedAssigneeDisplayName(email)
        })),
        showAssigneeSection: this.showAssigneeSection,
        location: {
          lat: 0,
          lng: 0,
          address: this.address
        }
      };

      if (this.id) {
        // 既存のタスクを更新
        await this.taskService.updateTask(this.id, taskData);
        console.log('タスクを更新しました:', this.id, '画像URL:', finalImageUrl);
      } else {
        // 新規タスクを作成
        await this.taskService.addTask(taskData);
        console.log('新規タスクを作成しました。画像URL:', finalImageUrl);
      }

      this.overlayService.close();
    } catch (error) {
      console.error('タスクの保存中にエラーが発生しました:', error);
      this.snackBar.open('タスクの保存に失敗しました', '閉じる', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['error-snackbar']
      });
    }
  }

  cancelTask() {
    this.overlayService.close();
  }

  onAssignedUserChange() {
    // 担当者変更時の処理（必要に応じて追加）
  }

  clearAllAssignees() {
    this.selectedAssignedUsers = [];
  }

  // メールアドレスの@より前の部分を取得するメソッド
  getEmailLocalPart(email: string): string {
    if (!email) return '';
    const parts = email.split('@');
    return parts.length > 0 ? parts[0] : '';
  }

  getSelectedAssigneeDisplayName(email: string): string {
    const user = this.assignedUsers.find(u => u.email === email);
    if (!user) return email;
    return user.displayName || user.email;
  }

  // Google DriveのファイルIDを抽出するメソッドを追加
  private extractFileId(url: string): string | null {
    // URLからファイルIDを抽出（複数のパターンに対応）
    const patterns = [
      /[\/?]([a-zA-Z0-9_-]{25,})/,      // 基本的なIDパターン
      /\/d\/([^/]+)/,                    // /d/IDパターン
      /id=([^&]+)/                       // id=IDパターン
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  validateDates(): boolean {
    if (this.startDate && this.dueDate) {
      const start = new Date(this.startDate);
      const due = new Date(this.dueDate);
      
      // 時間を0にリセットして日付のみを比較
      start.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      
      if (due < start) {
        this.dateError = '締切日は開始日以降の日付を選択してください';
        return false;
      }
    }
    this.dateError = null;
    return true;
  }

  onDateChange() {
    this.validateDates();
  }
}