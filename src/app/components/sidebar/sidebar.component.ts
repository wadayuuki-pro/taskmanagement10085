import { Component, OnInit, HostListener, NgZone, AfterViewInit, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { AuthService } from '../../auth.service';
import { Observable, Subscription } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { collection, collectionData, doc as firestoreDoc, getDoc, setDoc, updateDoc, query, orderBy, where, getDocs } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { TagService } from '../../pages/tags/tag.service';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { User } from '@firebase/auth';
import { NetworkStatusComponent } from '../network-status/network-status.component';

interface Tag {
  id?: string;
  name: string;
  order: number;
  createdAt: Date;
  ownerId?: string;
  assignedUserIds?: string[];
}

interface UserProfile {
  displayName?: string;
  email?: string;
  photoURL?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    MatIconModule, 
    MatListModule, 
    DragDropModule, 
    MatButtonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    NetworkStatusComponent
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent implements OnInit, AfterViewInit, OnDestroy {
  topMenuItems = [
    { label: 'ホーム',icon: 'check_circle', route: '/home'},
    { label: 'リマインダー',icon: 'notifications', route: '/reminder'},
  ];
  bottomMenuItems = [
    { label: 'アーカイブ',icon: 'archive', route: '/archive'},
    { label: 'ゴミ箱',icon: 'delete', route: '/trash'},
    { label: '設定',icon: 'settings', route: '/settings'},
    { label: 'カレンダー同期',icon: 'sync', route: '/calendar-sync'},
  ];

  tags$!: Observable<Tag[]>;
  tags: Tag[] = [];
  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  selectedTag: Tag | null = null;
  private subscriptions: Subscription[] = [];
  
  // ユーザー情報関連
  currentUser: User | null = null;
  userProfile: UserProfile = {};
  isEditingName = false;
  newDisplayName = '';
  isGoogleUser = false;

  constructor(
    public router: Router, 
    private authService: AuthService, 
    @Inject(PLATFORM_ID) private platformId: Object,
    private firestore: Firestore,
    private tagService: TagService,
    private ngZone: NgZone
  ) {
    // ユーザー情報の取得
    this.subscriptions.push(
      this.authService.getCurrentUser().subscribe(user => {
        if (user) {
          this.currentUser = user as User;
          this.isGoogleUser = user.providerData?.some(provider => provider?.providerId === 'google.com') ?? false;
          this.userProfile = {
            displayName: user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || ''
          };
          this.newDisplayName = this.userProfile.displayName || '';
          
          // Firestoreからユーザープロファイルを取得
          this.loadUserProfile(user.uid);
        } else {
          this.currentUser = null;
          this.isGoogleUser = false;
          this.userProfile = {};
          this.newDisplayName = '';
        }
      })
    );
  }

  // ユーザープロファイルをFirestoreから読み込む
  async loadUserProfile(userId: string) {
    try {
      const userDocRef = firestoreDoc(this.firestore, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data && data['displayName']) {
          this.ngZone.run(() => {
            this.userProfile.displayName = data['displayName'];
            this.newDisplayName = data['displayName'];
          });
        }
      } else {
        // ユーザードキュメントが存在しない場合は作成
        await setDoc(userDocRef, {
          displayName: this.userProfile.displayName,
          email: this.userProfile.email,
          photoURL: this.userProfile.photoURL,
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error('ユーザープロファイルの読み込みエラー:', error);
    }
  }

  // 表示名の編集を開始
  startEditingName() {
    this.isEditingName = true;
  }

  // 表示名の保存
  async saveDisplayName() {
    if (!this.currentUser) return;
    
    try {
      // Firestoreに保存
      const userDocRef = firestoreDoc(this.firestore, 'users', this.currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: this.newDisplayName
      });
      
      // ローカルの状態を更新
      this.ngZone.run(() => {
        this.userProfile.displayName = this.newDisplayName;
        this.isEditingName = false;
      });
    } catch (error) {
      console.error('表示名の保存エラー:', error);
    }
  }

  // 表示名の編集をキャンセル
  cancelEditingName() {
    this.newDisplayName = this.userProfile.displayName || '';
    this.isEditingName = false;
  }

  // クリック以外の場所をクリックしたときにコンテキストメニューを閉じる
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const contextMenu = document.querySelector('.context-menu');
    if (contextMenu && !contextMenu.contains(event.target as Node)) {
      this.contextMenuVisible = false;
    }
  }

  async logout() {
    const confirmed = window.confirm('ログアウトしますか？');
    if (!confirmed) {return;
  }

    try {
      await this.authService.signOut();
      this.router.navigate(['/sign-in']);
    } catch (error) {
      console.error('ログアウトエラー', error);
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // TagServiceのgetTags()を使用して、適切にフィルタリングされたタグのみを取得
      this.tags$ = this.tagService.getTags();
      
      // タグの変更を監視して配列も更新
        this.subscriptions.push(
        this.tags$.subscribe(tags => {
          this.tags = tags;
          })
        );
    }
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  navigateTo(tagName: string | undefined) {
    if (!tagName) {
      console.error('navigateTo: tagNameがundefinedです！');
      return;
    }
    this.router.navigate(['/tag', tagName]);
    console.log('タグ名のページに移動', tagName);
  }
  

  async drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.tags, event.previousIndex, event.currentIndex);

    const batchUpdate = this.tags.map((tag, index) => {
      if (tag.id) {
        const tagRef = firestoreDoc(this.firestore, 'tags', tag.id);
        return updateDoc(tagRef, { order: index });
      }
      return Promise.resolve();
    });

    try {
      await Promise.all(batchUpdate);
      console.log('並び替え完了', this.tags);
    } catch (error) {
      console.error('並び替えエラー', error);
    }
  }

  onContextMenu(event: MouseEvent, tag: Tag) {
    event.preventDefault();
    this.selectedTag = tag;
    this.contextMenuVisible = true;
    this.contextMenuPosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  async deleteTag() {
    if (!this.selectedTag || !this.selectedTag.id) return;
    
        try {
          await this.tagService.deleteTag(this.selectedTag.id);
          this.contextMenuVisible = false;
        } catch (error) {
      console.error('タグの削除エラー:', error);
    }
  }

  ngAfterViewInit(){
    if(isPlatformBrowser(this.platformId)){
      this.ngZone.runOutsideAngular(() => {
        const sidebar = document.querySelector('.sidebar') as HTMLElement;
        const resizer = sidebar.querySelector('.resizer') as HTMLElement;
      
        let isResizing = false;
      
        resizer.addEventListener('mousedown', (e) => {
          isResizing = true;
          e.preventDefault();
        });
      
        window.addEventListener('mousemove', (e) => {
          if (!isResizing) return;
          const newWidth = e.clientX;
          if(newWidth > 100 && newWidth < 300){
            sidebar.style.width = `${newWidth}px`;
            document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
          }
        });
      
        window.addEventListener('mouseup', () => {
          isResizing = false;
        });
      });
    }
  }
}
