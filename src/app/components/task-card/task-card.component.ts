import { Component, Input, Output, EventEmitter, inject, OnInit, ViewContainerRef, ComponentRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { Firestore, Timestamp, doc, updateDoc } from '@angular/fire/firestore';
import { ImagePreviewDialogComponent } from '../image-preview-dialog/image-preview-dialog.component';
import { GoogleDriveService } from '../../services/google-drive.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { firstValueFrom } from 'rxjs';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { OverlayService } from '../task-input/overlay.service';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.css']
})
export class TaskCardComponent implements OnInit {
  @Input() task!: Task;
  @Input() mode: 'home' | 'archive' | 'trash' | 'tag' = 'home';
  @Input() showActions: boolean = false;
  @Input() assignedUsers: { email: string; displayName: string }[] = [];

  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() archive = new EventEmitter<any>();
  @Output() restore = new EventEmitter<any>();
  @Output() parmanentlyDelete = new EventEmitter<any>();
  @Output() duplicate = new EventEmitter<Task>();

  private firestore: Firestore = inject(Firestore);
  private taskService: TaskService = inject(TaskService);
  private dialog: MatDialog = inject(MatDialog);
  private googleDriveService = inject(GoogleDriveService);
  private googleAuthService = inject(GoogleAuthService);
  private overlayService = inject(OverlayService);

  displayImageUrl: string | null = null;

  private contextMenuRef: ComponentRef<ContextMenuComponent> | null = null;

  selectedAssignee: string = '';

  constructor(
    private viewContainerRef: ViewContainerRef
  ) {}

  async ngOnInit() {
    if (this.task.imageUrl) {
      console.log('タスクID:', this.task.id);
      console.log('元の画像URL:', this.task.imageUrl);
      
      try {
        // Google DriveのファイルIDを抽出
        const fileId = this.extractFileId(this.task.imageUrl);
        if (fileId) {
          // シンプルな形式のURLを使用
          this.displayImageUrl = `https://drive.google.com/uc?id=${fileId}`;
          console.log('更新された画像URL:', this.displayImageUrl);
        } else {
          this.displayImageUrl = this.task.imageUrl;
        }
      } catch (error) {
        console.error('画像URLの更新に失敗しました:', error);
        this.displayImageUrl = this.task.imageUrl;
      }
    }
  }

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

  showImagePreview(event: MouseEvent) {
    event.stopPropagation(); // タスクカードのクリックイベントを防止
    if (this.displayImageUrl) {
      const fileId = this.extractFileId(this.displayImageUrl);
      if (fileId) {
        // Google Driveビューアを使用
        const viewerUrl = `https://drive.google.com/file/d/${fileId}/view`;
        window.open(viewerUrl, '_blank');
      } else {
        // ファイルIDが取得できない場合は従来のダイアログを使用
        this.dialog.open(ImagePreviewDialogComponent, {
          data: { imageUrl: this.displayImageUrl },
          maxWidth: '90vw',
          maxHeight: '90vh'
        });
      }
    }
  }

  convertToDate(timestamp: any): Date {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    return timestamp;
  }

  onClick() {
    this.edit.emit(this.task);
  }

  onRightClick(event: MouseEvent): boolean {
    event.preventDefault();
    if (this.mode === 'home' || this.mode === 'tag') {
      this.showContextMenu(event);
    }
    return false;
  }

  private showContextMenu(event: MouseEvent) {
    // 既存のコンテキストメニューがあれば削除
    this.removeContextMenu();

    // 新しいコンテキストメニューを作成
    const componentRef = this.viewContainerRef.createComponent(ContextMenuComponent);
    this.contextMenuRef = componentRef;

    // コンテキストメニューの位置を設定
    const contextMenu = componentRef.location.nativeElement;
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;

    // イベントハンドラを設定
    componentRef.instance.duplicate.subscribe(() => {
      this.duplicateTask();
    });

    componentRef.instance.closeMenu.subscribe(() => {
      this.removeContextMenu();
    });
  }

  private removeContextMenu() {
    if (this.contextMenuRef) {
      this.contextMenuRef.destroy();
      this.contextMenuRef = null;
    }
  }

  duplicateTask() {
    // タイトルから「（コピー）」を一旦削除し、新しく追加する
    const baseTitle = this.task.title.replace(/（コピー）/g, '').trim();
    const title = `${baseTitle}（コピー）`;

    const duplicatedTask: Partial<Task> = {
      title: title,
      content: this.task.content,
      startDate: this.task.startDate,
      dueDate: this.task.dueDate,
      priority: this.task.priority,
      status: this.task.status,
      tag: this.task.tag,
      location: this.task.location,
      imageUrl: this.task.imageUrl
    };

    if (this.mode === 'tag') {
      // タグページの場合は、OverlayServiceを使用してタスク入力画面を表示
      this.overlayService.openTaskInput(duplicatedTask);
    } else {
      // ホームページの場合は、従来通りイベントを発行
      this.duplicate.emit(duplicatedTask as Task);
    }
    
    // コンテキストメニューを閉じる
    this.removeContextMenu();
  }

  archiveTask(event: MouseEvent, task: Task) {
    event.stopPropagation(); // イベントの伝播を止める
    // アーカイブ処理を追加
    this.archive.emit(task);
  }

  deleteTask(event: MouseEvent, task: Task) {
    event.stopPropagation(); 
    this.delete.emit(task);
  }

  unarchiveTask(event: Event){
    event.stopPropagation();
    this.archive.emit(this.task);
  }

  getPriorityLabel(priority: 'high' | 'medium' | 'low'): string {
    const map: Record<string, string> = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return map[priority] ?? '';
  }

  getPriorityClass(priority: 'high' | 'medium' | 'low'): string {
    switch(priority){
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
    }
  }

  getStatusIcon(status: '未着手' | '進行中' | '完了'): string {
    switch(status) {
      case '未着手':
        return 'radio_button_unchecked';
      case '進行中':
        return 'play_circle_outline';
      case '完了':
        return 'check_circle_outline';
      default:
        return 'help_outline';
    }
  }

  getStatusClass(status: '未着手' | '進行中' | '完了'): string {
    switch(status) {
      case '未着手':
        return 'status-incomplete';
      case '進行中':
        return 'status-in-progress';
      case '完了':
        return 'status-complete';
      default:
        return '';
    }
  }

  restoreTask(event: Event){
    event.stopPropagation();
    this.restore.emit(this.task);
  }

  permanentlyDeleteTask(event: Event){
    event.stopPropagation();
    this.parmanentlyDelete.emit(this.task);
  }

  // 位置情報を表示用にフォーマット
  getLocationDisplay(location: any): string {
    if (!location) return '';
    
    // 住所がある場合は住所を表示
    if (location.address) {
      return location.address;
    }
    
    // 住所がない場合は緯度経度を表示
    return `緯度: ${location.lat.toFixed(6)}, 経度: ${location.lng.toFixed(6)}`;
  }

  // 位置情報のツールチップを取得
  getLocationTooltip(location: any): string {
    if (!location) return '';
    
    // 住所がある場合は住所を表示
    if (location.address) {
      return location.address;
    }
    
    // 住所がない場合は緯度経度を表示
    return `緯度: ${location.lat.toFixed(6)}, 経度: ${location.lng.toFixed(6)}`;
  }

  async assignTaskToUser() {
    if (!this.selectedAssignee || !this.task?.id) return;
    const taskRef = doc(this.firestore, 'tasks', this.task.id);
    await updateDoc(taskRef, { assignedUser: this.selectedAssignee });
    this.task.assignedUser = this.selectedAssignee;
    this.selectedAssignee = '';
  }

  getAssignedUserName(): string | null {
    if (!this.task.assignedUser) return null;
    const user = this.assignedUsers.find(u => u.email === this.task.assignedUser);
    return user ? user.displayName : this.task.assignedUser;
  }

  getAssignedUserNames(): string {
    if (!this.task.assignedUsers || this.task.assignedUsers.length === 0) return '';
    
    const userNames = this.task.assignedUsers.map(user => user.displayName || user.email);
    return userNames.join(', ');
  }
}
