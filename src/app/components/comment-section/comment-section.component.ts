import { Component, OnInit, Input, Inject, OnDestroy, SimpleChanges, OnChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommentService } from '../../services/comment.service';
import { AuthService } from '../../auth.service';
import { Comment } from '../../models/comment.model';
import { User } from '@angular/fire/auth';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from '../../services/message.service';
import { Message } from '../../models/message.model';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { Firestore } from '@angular/fire/firestore';
import { collection, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-comment-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './comment-section.component.html',
  styleUrls: ['./comment-section.component.scss']
})
export class CommentSectionComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tagId!: string;
  @ViewChild('commentTextarea') commentTextarea!: ElementRef;

  commentForm: FormGroup;
  comments: Message[] = [];
  currentUserEmail: string = '';
  currentUserName: string = '';
  private messageSubscription: Subscription | null = null;
  private userSubscription: Subscription | null = null;
  
  // 返信関連のプロパティ
  replyingTo: Message | null = null;
  replyForm: FormGroup;
  
  // @メンション関連のプロパティ
  projectUsers: { email: string; displayName: string }[] = [];
  mentionSuggestions: { email: string; displayName: string }[] = [];
  showMentionSuggestions = false;
  mentionFilter = '';
  mentionPosition = { top: 0, left: 0 };
  private mentionSubscription: Subscription | null = null;
  currentUser: User | null = null;
  isSubmitting = false;
  private mentionTrigger = '@';
  cursorPosition = 0;

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    @Inject(AuthService) private authService: AuthService,
    private firestore: Firestore
  ) {
    this.commentForm = this.fb.group({
      content: ['', Validators.required]
    });
    
    this.replyForm = this.fb.group({
      content: ['', Validators.required]
    });
  }

  ngOnInit() {
    console.log('CommentSectionComponent initialized with tagId:', this.tagId);
    
    // ユーザー情報の取得を先に行う
    this.initializeUserSubscription();
    
    // tagIdが設定されている場合はコメントを読み込む
    if (this.tagId) {
      console.log('Initial tagId is set, loading comments');
      this.loadComments();
      // プロジェクトユーザーの読み込みは少し遅延させる
      setTimeout(() => {
        this.loadProjectUsers();
      }, 100);
    } else {
      console.warn('Initial tagId is not set');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tagId']) {
      console.log('tagId changed:', changes['tagId'].currentValue, 'Previous value:', changes['tagId'].previousValue);
      
      // tagIdが変更された場合は常にコメントを読み込む
      if (changes['tagId'].currentValue) {
        console.log('Loading comments with new tagId');
        this.loadComments();
        // プロジェクトユーザーの読み込みは少し遅延させる
        setTimeout(() => {
          this.loadProjectUsers();
        }, 100);
      } else {
        console.warn('tagId is empty after change');
        this.comments = []; // tagIdが空の場合はコメントをクリア
        this.projectUsers = []; // プロジェクトユーザーもクリア
      }
    }
  }

  ngOnDestroy() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
      this.userSubscription = null;
    }
    if (this.mentionSubscription) {
      this.mentionSubscription.unsubscribe();
      this.mentionSubscription = null;
    }
  }

  loadComments() {
    if (!this.tagId) {
      console.log('tagId is empty, not loading comments');
      return;
    }
    
    console.log('コメントを読み込みます。tagId:', this.tagId);
    
    // 既存のサブスクリプションを解除
    if (this.messageSubscription) {
      console.log('Unsubscribing from previous message subscription');
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }
    
    // 新しいサブスクリプションを作成
    try {
      console.log('Creating new message subscription for tagId:', this.tagId);
      this.messageSubscription = this.messageService.getMessages(this.tagId).subscribe(
        messages => {
          console.log('コメントが更新されました。件数:', messages.length, 'コメント:', messages);
          this.comments = messages;
        },
        error => {
          console.error('コメントの読み込みに失敗しました:', error);
        }
      );
    } catch (error) {
      console.error('メッセージサブスクリプションの作成に失敗しました:', error);
    }
  }

  onSubmit() {
    if (this.commentForm.valid && this.tagId && !this.isSubmitting) {
      this.isSubmitting = true;
      try {
        const content = this.commentForm.get('content')?.value;
        if (content) {
          console.log('コメントを送信します:', content);
          console.log('現在のtagId:', this.tagId);
          
          // 送信ボタンを無効化して二重送信を防止
          const submitButton = document.querySelector('.comment-form button[type="submit"]') as HTMLButtonElement;
          if (submitButton) {
            submitButton.disabled = true;
          }
          
          // コメント送信前のコメント数を記録
          const beforeCount = this.comments.length;
          console.log('送信前のコメント数:', beforeCount);
          
          this.messageService.sendMessage(this.tagId, content, []).then((messageId) => {
            console.log('コメントが送信されました。メッセージID:', messageId);
            this.commentForm.reset();
            
            // 送信ボタンを再度有効化
            if (submitButton) {
              submitButton.disabled = false;
            }
            
            // コメント送信後にコメントリストを再読み込み
            console.log('コメントリストを再読み込みします');
            
            // Firestoreの更新を待つために少し遅延させる
            setTimeout(() => {
              this.loadComments();
              
              // 再読み込み後のコメント数を確認し、必要に応じて再試行
              setTimeout(() => {
                console.log('再読み込み後のコメント数:', this.comments.length);
                if (this.comments.length <= beforeCount) {
                  console.warn('コメント数が増加していません。再度読み込みを試みます。');
                  // もう一度少し遅延させて再読み込み
                  setTimeout(() => {
                    this.loadComments();
                  }, 1000);
                }
              }, 1000);
            }, 1000);
          }).catch(error => {
            console.error('コメントの送信に失敗しました:', error);
            
            // エラー時も送信ボタンを再度有効化
            if (submitButton) {
              submitButton.disabled = false;
            }
          });
        }
      } catch (error) {
        console.error('コメントの送信に失敗しました:', error);
      } finally {
        this.isSubmitting = false;
      }
    } else {
      console.warn('フォームが無効か、tagIdが設定されていません', {
        formValid: this.commentForm.valid,
        tagId: this.tagId
      });
    }
  }

  deleteComment(commentId: string) {
    this.messageService.deleteMessage(commentId).then(() => {
      // コメント削除後にコメントリストを再読み込み
      this.loadComments();
    }).catch(error => {
      console.error('コメントの削除に失敗しました:', error);
    });
  }

  canDeleteComment(comment: Message): boolean {
    return comment.senderEmail === this.currentUserEmail;
  }

  private initializeUserSubscription() {
    // 既存のサブスクリプションを解除
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    
    // 新しいサブスクリプションを作成
    this.userSubscription = this.authService.getCurrentUser().subscribe((user: User | null) => {
      if (user) {
        this.currentUserEmail = user.email || '';
        this.currentUserName = user.displayName || '匿名';
        console.log('Current user set:', this.currentUserEmail, this.currentUserName);
        this.currentUser = user;
      } else {
        this.currentUserEmail = '';
        this.currentUserName = '';
        console.log('No user logged in');
      }
    });
  }

  // 返信を開始する
  startReply(comment: Message) {
    this.replyingTo = comment;
    this.replyForm.reset();
  }

  // 返信をキャンセルする
  cancelReply() {
    this.replyingTo = null;
    this.replyForm.reset();
  }

  // 返信を送信する
  onSubmitReply() {
    if (this.replyForm.valid && this.tagId && this.replyingTo && this.replyingTo.id) {
      const content = this.replyForm.get('content')?.value;
      if (content) {
        console.log('返信を送信します:', content);
        console.log('返信先:', this.replyingTo.senderName);
        
        // 送信ボタンを無効化して二重送信を防止
        const submitButton = document.querySelector('.reply-form button[type="submit"]') as HTMLButtonElement;
        if (submitButton) {
          submitButton.disabled = true;
        }
        
        // コメント送信前のコメント数を記録
        const beforeCount = this.comments.length;
        console.log('送信前のコメント数:', beforeCount);
        
        this.messageService.sendReplyMessage(
          this.tagId, 
          content, 
          this.replyingTo.id, 
          this.replyingTo.senderName
        ).then((messageId) => {
          console.log('返信が送信されました。メッセージID:', messageId);
          this.replyForm.reset();
          this.replyingTo = null;
          
          // 送信ボタンを再度有効化
          if (submitButton) {
            submitButton.disabled = false;
          }
          
          // コメント送信後にコメントリストを再読み込み
          console.log('コメントリストを再読み込みします');
          
          // Firestoreの更新を待つために少し遅延させる
          setTimeout(() => {
            this.loadComments();
            
            // 再読み込み後のコメント数を確認し、必要に応じて再試行
            setTimeout(() => {
              console.log('再読み込み後のコメント数:', this.comments.length);
              if (this.comments.length <= beforeCount) {
                console.warn('コメント数が増加していません。再度読み込みを試みます。');
                // もう一度少し遅延させて再読み込み
                setTimeout(() => {
                  this.loadComments();
                }, 1000);
              }
            }, 1000);
          }, 1000);
        }).catch(error => {
          console.error('返信の送信に失敗しました:', error);
          
          // エラー時も送信ボタンを再度有効化
          if (submitButton) {
            submitButton.disabled = false;
          }
        });
      }
    } else {
      console.warn('返信フォームが無効か、tagIdまたは返信先が設定されていません', {
        formValid: this.replyForm.valid,
        tagId: this.tagId,
        replyingTo: this.replyingTo
      });
    }
  }

  // @メンションを選択する
  selectMention(user: { email: string; displayName: string }, form: FormGroup) {
    const content = form.get('content')?.value || '';
    const textarea = form === this.replyForm 
      ? document.querySelector('.reply-form textarea[formcontrolname="content"]') as HTMLTextAreaElement
      : document.querySelector('.comment-form textarea[formcontrolname="content"]') as HTMLTextAreaElement;
    
    if (textarea) {
      const cursorPosition = textarea.selectionStart;
      const beforeCursor = content.substring(0, cursorPosition);
      const afterCursor = content.substring(cursorPosition);
      
      // @の後の文字列を置き換える
      const match = beforeCursor.match(/@(\w*)$/);
      if (match) {
        const startPos = beforeCursor.lastIndexOf('@');
        const newContent = content.substring(0, startPos) + `@${user.displayName} ` + afterCursor;
        
        // フォームの値を更新（setValueを使用）
        form.setValue({
          content: newContent
        });
        
        // カーソル位置を更新
        setTimeout(() => {
          const newCursorPos = startPos + user.displayName.length + 2; // +2 for @ and space
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        });
      }
    }
    
    this.showMentionSuggestions = false;
  }

  // 返信入力時に@メンションを検出
  onReplyInput(event: any) {
    console.log('返信入力イベント発生');
    const textarea = event.target as HTMLTextAreaElement;
    const content = this.replyForm.get('content')?.value || '';
    const cursorPosition = textarea.selectionStart;
    
    console.log('返信入力内容:', content);
    console.log('カーソル位置:', cursorPosition);
    
    // @の後の文字列を取得（正規表現パターンを修正）
    const beforeCursor = content.substring(0, cursorPosition);
    const match = beforeCursor.match(/@([^\s]*)$/);
    
    console.log('@マッチ結果:', match);
    
    if (match) {
      this.mentionFilter = match[1].toLowerCase();
      console.log('メンションフィルター:', this.mentionFilter);
      
      // プロジェクトユーザーが空の場合は再読み込みを試みる
      if (this.projectUsers.length === 0) {
        console.log('プロジェクトユーザーが空のため、再読み込みを試みます');
        this.loadProjectUsers();
      }
      
      console.log('プロジェクトユーザー数:', this.projectUsers.length);
      
      this.mentionSuggestions = this.projectUsers.filter(user => 
        user.displayName.toLowerCase().includes(this.mentionFilter) || 
        user.email.toLowerCase().includes(this.mentionFilter)
      );
      
      console.log('メンション候補数:', this.mentionSuggestions.length);
      
      if (this.mentionSuggestions.length > 0) {
        this.showMentionSuggestions = true;
        console.log('メンション候補を表示');
        
        // ドロップダウンの位置を計算
        const rect = textarea.getBoundingClientRect();
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        const lines = beforeCursor.split('\n').length;
        
        this.mentionPosition = {
          top: rect.top + (lines * lineHeight) + window.scrollY,
          left: rect.left + 10
        };
      } else {
        this.showMentionSuggestions = false;
        console.log('メンション候補なし');
      }
    } else {
      this.showMentionSuggestions = false;
      console.log('@マッチなし');
    }
  }

  // プロジェクト参加者を読み込む
  private async loadProjectUsers() {
    try {
      console.log('プロジェクトユーザーの読み込みを開始します');
      
      // タグに割り当てられたユーザーのみを取得
      if (this.tagId) {
        const tagRef = doc(this.firestore, 'tags', this.tagId);
        const tagDoc = await getDoc(tagRef);
        if (tagDoc.exists()) {
          const tagData = tagDoc.data();
          if (tagData) {
            // assignedUsersとassignedUserIdsの両方をチェック
            const assignedUsers = tagData['assignedUsers'] || [];
            const assignedUserIds = tagData['assignedUserIds'] || [];
            
            // assignedUsersが存在する場合はそれを使用
            if (assignedUsers.length > 0) {
              this.projectUsers = assignedUsers;
            } else if (assignedUserIds.length > 0) {
              // assignedUserIdsからユーザー情報を取得
              this.projectUsers = await Promise.all(assignedUserIds.map(async (userId: string) => {
                try {
                  const userDoc = await getDoc(doc(this.firestore, 'users', userId));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    return {
                      email: userData['email'] || userId,
                      displayName: userData['displayName'] || 'ユーザー'
                    };
                  }
                } catch (error) {
                  console.error('ユーザー情報の取得に失敗しました:', error);
                }
                return { email: userId, displayName: 'ユーザー' };
              }));
            }
            
            console.log('タグに割り当てられたユーザー数:', this.projectUsers.length);
          } else {
            this.projectUsers = [];
          }
        } else {
          this.projectUsers = [];
        }
      } else {
        this.projectUsers = [];
      }

      console.log('最終的なプロジェクトユーザー数:', this.projectUsers.length);
    } catch (error) {
      console.error('プロジェクトユーザーの読み込みエラー:', error);
      this.projectUsers = [];
    }
  }
  
  // @メンションの候補を表示する
  showMentionDropdown(event: any, form: FormGroup) {
    const textarea = event.target as HTMLTextAreaElement;
    const content = form.get('content')?.value || '';
    const cursorPosition = textarea.selectionStart;
    
    // @の後の文字列を取得
    const beforeCursor = content.substring(0, cursorPosition);
    const match = beforeCursor.match(/@(\w*)$/);
    
    if (match) {
      this.mentionFilter = match[1].toLowerCase();
      console.log('メンションフィルター:', this.mentionFilter);
      console.log('プロジェクトユーザー数:', this.projectUsers.length);
      
      // プロジェクトユーザーが空の場合は再読み込みを試みる
      if (this.projectUsers.length === 0) {
        console.log('プロジェクトユーザーが空のため、再読み込みを試みます');
        this.loadProjectUsers();
      }
      
      this.mentionSuggestions = this.projectUsers.filter(user => 
        user.displayName.toLowerCase().includes(this.mentionFilter) || 
        user.email.toLowerCase().includes(this.mentionFilter)
      );
      
      console.log('メンション候補数:', this.mentionSuggestions.length);
      
      if (this.mentionSuggestions.length > 0) {
        this.showMentionSuggestions = true;
        
        // ドロップダウンの位置を計算
        const rect = textarea.getBoundingClientRect();
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        const lines = beforeCursor.split('\n').length;
        
        this.mentionPosition = {
          top: rect.top + (lines * lineHeight) + window.scrollY,
          left: rect.left + 10
        };
      } else {
        this.showMentionSuggestions = false;
      }
    } else {
      this.showMentionSuggestions = false;
    }
  }
  
  // @メンションの候補を閉じる
  closeMentionDropdown() {
    this.showMentionSuggestions = false;
  }
  
  // コメント入力時に@メンションを検出
  onCommentInput(event: any) {
    const content = event.target.value;
    const lastChar = content[content.length - 1];
    
    if (lastChar === this.mentionTrigger) {
      this.showMentionSuggestions = true;
      this.loadMentionSuggestions('');
    } else if (this.showMentionSuggestions) {
      const lastAtIndex = content.lastIndexOf(this.mentionTrigger);
      if (lastAtIndex !== -1) {
        const searchTerm = content.slice(lastAtIndex + 1);
        this.loadMentionSuggestions(searchTerm);
      } else {
        this.showMentionSuggestions = false;
      }
    }
  }
  
  private loadMentionSuggestions(searchTerm: string) {
    // ここでメンション候補をフィルタリング
    // 実際の実装では、ユーザーリストから検索する
    this.mentionSuggestions = this.projectUsers.filter(user => 
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  onKeyUp(event: KeyboardEvent) {
    const textarea = event.target as HTMLTextAreaElement;
    this.cursorPosition = textarea.selectionStart;
    const text = textarea.value;
    const beforeCursor = text.substring(0, this.cursorPosition);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      this.mentionFilter = mentionMatch[1];
      console.log('onKeyUp - メンションフィルター:', this.mentionFilter);
      console.log('onKeyUp - プロジェクトユーザー数:', this.projectUsers.length);
      
      // プロジェクトユーザーが空の場合は再読み込みを試みる
      if (this.projectUsers.length === 0) {
        console.log('onKeyUp - プロジェクトユーザーが空のため、再読み込みを試みます');
        this.loadProjectUsers();
      }
      
      this.showMentionSuggestions = true;
      this.filterMentionSuggestions();
      
      console.log('onKeyUp - メンション候補数:', this.mentionSuggestions.length);
    } else {
      this.showMentionSuggestions = false;
    }
  }

  filterMentionSuggestions() {
    console.log('filterMentionSuggestions - 開始');
    console.log('フィルター:', this.mentionFilter);
    console.log('プロジェクトユーザー数:', this.projectUsers.length);
    
    // プロジェクトユーザーが空の場合は再読み込みを試みる
    if (this.projectUsers.length === 0) {
      console.log('filterMentionSuggestions - プロジェクトユーザーが空のため、再読み込みを試みます');
      this.loadProjectUsers();
      return; // 再読み込み中は処理を中断
    }
    
    // プロジェクトユーザーからメンション候補をフィルタリング
    this.mentionSuggestions = this.projectUsers.filter(user => 
      user.displayName.toLowerCase().includes(this.mentionFilter.toLowerCase()) || 
      user.email.toLowerCase().includes(this.mentionFilter.toLowerCase())
    );
    
    console.log('メンション候補数:', this.mentionSuggestions.length);
    if (this.mentionSuggestions.length > 0) {
      console.log('最初の候補:', this.mentionSuggestions[0]);
    }
  }

  // メッセージの内容をHTMLに変換する
  formatMessageContent(content: string): string {
    if (!content) return '';

    // メンションを処理（メールアドレス部分を削除）
    let formattedContent = content.replace(/@([^\s]+)\s*\([^)]+\)/g, (match, displayName) => {
      return `<span class="mention">@${displayName}</span>`;
    });

    // 改行を<br>タグに変換
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    return formattedContent;
  }
} 