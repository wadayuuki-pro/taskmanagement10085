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
import { LocationPickerComponent } from '../location-picker/location-picker.component';
import { Timestamp } from '@angular/fire/firestore';
import { TagService } from '../../services/tag.service';
import { AuthService } from '../../auth.service';
import { User } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { Tag } from '../../pages/tags/tag.service';

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
  location?: {
    lat: number;
    lng: number;
    address?: string;
  } | null;
  assignedUser?: string;
  showAssigneeSection?: boolean;
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
    LocationPickerComponent
  ],
  templateUrl: './task-input.component.html',
  styleUrls: ['./task-input.component.css'],
  providers: [MatDatepickerModule, TagService]
})
export class TaskInputComponent implements OnInit {
  @Input() taskToEdit?: any;
  @Input() assignedUsers: { email: string; displayName: string }[] = [];
  @Input() showAssigneeSection: boolean = false;

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
  location: { lat: number; lng: number; address?: string } | null = null;
  imageFile: File | null = null;
  public assignedUser: string = '';
  public selectedAssignedUsers: string[] = [];
  public isEditMode: boolean = false;

  private firestore = inject(Firestore);
  private taskService = inject(TaskService);
  private googleDriveService = inject(GoogleDriveService);
  private googleAuthService = inject(GoogleAuthService);
  private dialog = inject(MatDialog);
  private overlayService = inject(OverlayService);
  private tagService = inject(TagService);
  private authService = inject(AuthService);

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
    });

    if (this.isEditMode) {
      console.log('TaskInputComponent: 編集モードでタスクデータを処理します', this.injectedTaskData);
      
      this.title = this.injectedTaskData.title || '';
      this.content = this.injectedTaskData.content || '';
      
      // FirestoreのTimestamp型をDate型に変換
      if (this.injectedTaskData.startDate && this.injectedTaskData.startDate.toDate) {
        this.startDate = this.injectedTaskData.startDate.toDate();
      } else if (this.injectedTaskData.startDate) {
        this.startDate = new Date(this.injectedTaskData.startDate);
      } else {
        this.startDate = null;
      }
      
      if (this.injectedTaskData.dueDate && this.injectedTaskData.dueDate.toDate) {
        this.dueDate = this.injectedTaskData.dueDate.toDate();
      } else if (this.injectedTaskData.dueDate) {
        this.dueDate = new Date(this.injectedTaskData.dueDate);
      } else {
        this.dueDate = null;
      }
      
      this.priority = this.injectedTaskData.priority || 'medium';
      this.status = this.injectedTaskData.status || '未着手';
      this.tagNames = this.injectedTaskData.tag || '';
      this.imageUrl = this.injectedTaskData.imageUrl || null;
      this.location = this.injectedTaskData.location || null;
      
      // 編集時は既存の担当者情報を設定（過去に担当者が追加された場合のみ）
      if (this.injectedTaskData.assignedUsers && this.injectedTaskData.assignedUsers.length > 0) {
        if (Array.isArray(this.injectedTaskData.assignedUsers)) {
          this.selectedAssignedUsers = this.injectedTaskData.assignedUsers.map((user: { email: string; displayName: string }) => user.email);
          this.assignedUsers = this.injectedTaskData.assignedUsers;
        } else {
          const users = Object.values(this.injectedTaskData.assignedUsers) as { email: string; displayName: string }[];
          this.selectedAssignedUsers = users.map(user => user.email);
          this.assignedUsers = users;
        }
        // 担当者が存在する場合のみ担当者セクションを表示
        this.showAssigneeSection = true;
      } else {
        // 担当者が存在しない場合は担当者セクションを非表示
        this.showAssigneeSection = false;
        this.assignedUsers = [];
        this.selectedAssignedUsers = [];
      }
      
      console.log('TaskInputComponent: 処理後のデータ', {
        title: this.title,
        content: this.content,
        startDate: this.startDate,
        dueDate: this.dueDate,
        priority: this.priority,
        status: this.status,
        tagNames: this.tagNames,
        showAssigneeSection: this.showAssigneeSection,
        selectedAssignedUsers: this.selectedAssignedUsers,
        assignedUsers: this.assignedUsers
      });

      // 編集時はタグにアサインされているユーザーを取得
      if (this.tagNames) {
        this.loadAssignedUsers();
      }
    } else {
      // 新規作成時は担当者セクションを表示
      this.showAssigneeSection = true;
      // 新規作成時は担当者リストを空にする
      this.assignedUsers = [];
      this.selectedAssignedUsers = [];
      
      // タグが指定されている場合は、そのタグにアサインされているユーザーを取得
      if (this.injectedTaskData?.tag) {
        this.tagNames = this.injectedTaskData.tag;
        this.loadAssignedUsers();
      }
    }
  }

  // プロジェクトにアサインされているユーザーを取得するメソッドを追加
  async loadAssignedUsers() {
    try {
      // プロジェクト（タグ）にアサインされているユーザーを取得
      const tagId = this.tagNames; // タグ名をIDとして使用
      if (tagId) {
        const users = await this.tagService.getAssignedUsers(tagId);
        
        // 現在のユーザーが取得できている場合、ユーザーリストに追加
        if (this.currentUser && this.currentUser.email) {
          const currentUserData = {
            email: this.currentUser.email,
            displayName: this.currentUser.displayName || this.currentUser.email
          };
          
          // 現在のユーザーが既にリストに含まれていない場合のみ追加
          if (!users.some(user => user.email === currentUserData.email)) {
            users.push(currentUserData);
          }
        }
        
        // 新規作成時は担当者として選択しない
        if (!this.isEditMode) {
          this.assignedUsers = users;
          this.selectedAssignedUsers = [];
        } else {
          // 編集時は既存の担当者情報を保持
          this.assignedUsers = users;
        }
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

  onLocationChange(location: { lat: number; lng: number; address?: string } | null) {
    this.location = location;
    console.log('Location updated:', location);
  }

  async saveTask() {
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

      const taskData = {
        title: this.title,
        content: this.content,
        startDate: this.startDate ? Timestamp.fromDate(this.startDate) : null,
        dueDate: this.dueDate ? Timestamp.fromDate(this.dueDate) : null,
        priority: this.priority,
        status: this.status,
        tag: this.tagNames,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ownerId: this.currentUser.uid,
        assignedUsers: this.selectedAssignedUsers.map(email => ({
          email: email,
          displayName: this.getSelectedAssigneeDisplayName(email)
        })),
        showAssigneeSection: this.showAssigneeSection
      };

      if (this.id) {
        // 既存のタスクを更新
        await this.taskService.updateTask(this.id, taskData);
        console.log('タスクを更新しました:', this.id);
      } else {
        // 新規タスクを作成
        await this.taskService.addTask(taskData);
        console.log('新規タスクを作成しました');
      }

      this.overlayService.close();
    } catch (error) {
      console.error('タスクの保存中にエラーが発生しました:', error);
    }
  }

  cancelTask() {
    this.overlayService.close();
  }

  onAssignedUserChange() {
    // 担当者変更時の処理（必要に応じて追加）
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
}