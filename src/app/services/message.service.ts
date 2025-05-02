import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, getDocs, onSnapshot, Timestamp, getDoc, DocumentReference } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Message } from '../models/message.model';
import { AuthService } from '../auth.service';
import { firstValueFrom } from 'rxjs';

interface ProjectUser {
  email: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private firestore = inject(Firestore);
  private projectUsers: ProjectUser[] = [];
  private projectUsersLoaded = false;

  constructor(private authService: AuthService) {
    // 初期化時にプロジェクトユーザーを読み込む
    this.initializeProjectUsers();
  }

  // プロジェクトユーザーの初期化
  private async initializeProjectUsers() {
    await this.loadProjectUsers();
    this.setupProjectUsersListener();
  }

  // プロジェクトユーザーのリアルタイム監視
  private setupProjectUsersListener() {
    const tagsRef = collection(this.firestore, 'tags');

    // タグコレクションの監視
    onSnapshot(tagsRef, async (snapshot) => {
      const assignedUsers = await Promise.all(snapshot.docs.flatMap(async (tagDoc) => {
        const data = tagDoc.data();
        const assignedUserIds = data['assignedUserIds'] || [];
        
        // assignedUserIdsに対応するユーザー情報を取得
        return await Promise.all(assignedUserIds.map(async (userId: string) => {
          try {
            // usersコレクションからユーザー情報を取得
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
      }));

      // 重複を除去
      this.projectUsers = assignedUsers.flat().filter((user, index, self) =>
        index === self.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase())
      );

      this.projectUsersLoaded = true;
      console.log('プロジェクトユーザーを更新しました:', this.projectUsers);
    });
  }

  // プロジェクトユーザーを読み込む
  private async loadProjectUsers(): Promise<ProjectUser[]> {
    try {
      // タグコレクションからアサインされたユーザー情報を取得
      const tagsRef = collection(this.firestore, 'tags');
      const tagsSnapshot = await getDocs(tagsRef);
      const assignedUsers = await Promise.all(tagsSnapshot.docs.flatMap(async (tagDoc) => {
        const data = tagDoc.data();
        const assignedUserIds = data['assignedUserIds'] || [];
        
        // assignedUserIdsに対応するユーザー情報を取得
        return await Promise.all(assignedUserIds.map(async (userId: string) => {
          try {
            // usersコレクションからユーザー情報を取得
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
      }));

      // 重複を除去
      this.projectUsers = assignedUsers.flat().filter((user, index, self) =>
        index === self.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase())
      );

      this.projectUsersLoaded = true;
      console.log('プロジェクトユーザーを読み込みました:', this.projectUsers);
      return this.projectUsers;
    } catch (error) {
      console.error('プロジェクトユーザーの読み込みに失敗しました:', error);
      return [];
    }
  }

  // メッセージを取得する
  getMessages(tagId: string): Observable<Message[]> {
    console.log('getMessages called with tagId:', tagId);
    
    if (!tagId) {
      console.error('getMessages called with empty tagId');
      return new Observable<Message[]>(observer => {
        observer.next([]);
        return () => {};
      });
    }
    
    const messagesRef = collection(this.firestore, 'messages');
    console.log('Messages collection reference:', messagesRef);
    
    const q = query(
      messagesRef,
      where('tagId', '==', tagId),
      orderBy('createdAt', 'desc')
    );
    console.log('Firestore query created:', q);
    console.log('Query conditions:', {
      tagId: tagId,
      collection: 'messages'
    });

    return new Observable<Message[]>(observer => {
      console.log('Starting message subscription...');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('Received Firestore snapshot, size:', snapshot.size);
        const messages: Message[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          console.log('Document data:', data);
          messages.push({
            id: doc.id,
            tagId: data['tagId'],
            senderEmail: data['senderEmail'],
            senderName: data['senderName'],
            content: data['content'],
            createdAt: data['createdAt']?.toDate() || new Date(),
            updatedAt: data['updatedAt']?.toDate(),
            isRead: data['isRead'] || false,
            attachments: data['attachments'] || []
          });
        });
        console.log('Processed messages:', messages);
        observer.next(messages);
      }, error => {
        console.error('Error in Firestore snapshot:', error);
        observer.error(error);
      });

      return () => {
        console.log('Unsubscribing from message subscription');
        unsubscribe();
      };
    });
  }

  // メンションされたユーザーのメールアドレスを抽出する
  private async extractMentions(content: string, tagId: string): Promise<{ mentions: string[], formattedContent: string }> {
    const mentions: string[] = [];
    const mentionRegex = /@([^\s]+)/g;
    let match;
    let formattedContent = content;

    // プロジェクトユーザーが読み込まれていない場合は読み込みを待つ
    if (!this.projectUsersLoaded) {
      console.log('プロジェクトユーザーを読み込み中...');
      await this.loadProjectUsers();
    }

    console.log('メンション抽出を開始します。プロジェクトユーザー:', this.projectUsers);

    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedName = match[1];
      console.log('メンション検出:', mentionedName);
      
      // 表示名でユーザーを検索
      const user = this.projectUsers.find((u: ProjectUser) => {
        const nameMatch = u.displayName.toLowerCase() === mentionedName.toLowerCase();
        console.log(`ユーザーチェック - ${u.displayName}(${u.email}):`, {
          nameMatch,
          mentionedName: mentionedName.toLowerCase(),
          displayName: u.displayName.toLowerCase()
        });
        return nameMatch;
      });

      if (user && user.email) {
        console.log('メンションユーザーが見つかりました:', user);
        if (!mentions.includes(user.email)) { // 重複を防ぐ
          mentions.push(user.email);
          // メンションを表示名のみに置き換え
          formattedContent = formattedContent.replace(
            `@${mentionedName}`,
            `@${user.displayName}`
          );
        }
      } else {
        console.log('メンションユーザーが見つかりません:', mentionedName);
      }
    }

    console.log('抽出されたメンション:', mentions);
    return { mentions, formattedContent };
  }

  private getCurrentTagId(): string | null {
    // 現在のタグIDを取得するロジックを実装
    // 例: URLから取得する場合
    const url = window.location.href;
    const match = url.match(/\/tags\/([^\/]+)/);
    return match ? match[1] : null;
  }

  private async getAssignedUsers(tagId: string): Promise<{ email: string; displayName: string }[]> {
    try {
      const tagRef = doc(this.firestore, 'tags', tagId);
      const tagDoc = await getDoc(tagRef);
      
      if (!tagDoc.exists()) {
        console.log(`タグが見つかりません: ${tagId}`);
        return [];
      }

      const tagData = tagDoc.data();
      if (!tagData) {
        console.error(`タグデータが空です: ${tagId}`);
        return [];
      }

      const assignedUsers = tagData['assignedUsers'] || [];
      const assignedUserIds = tagData['assignedUserIds'] || [];

      if (assignedUsers.length > 0) {
        return assignedUsers;
      } else if (assignedUserIds.length > 0) {
        const users = await Promise.all(assignedUserIds.map(async (userId: string) => {
          try {
            const userDoc = await getDoc(doc(this.firestore, 'users', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                email: userData['email'] || userId,
                displayName: userData['displayName'] || 'ユーザー'
              };
            }
            return null;
          } catch (error) {
            console.error(`ユーザー情報の取得に失敗しました: ${userId}`, error);
            return null;
          }
        }));
        return users.filter(user => user !== null) as { email: string; displayName: string }[];
      }

      return [];
    } catch (error) {
      console.error(`プロジェクトユーザーの取得に失敗しました: ${tagId}`, error);
      return [];
    }
  }

  // メッセージを送信する
  async sendMessage(tagId: string, content: string, attachments: any[] = []): Promise<string> {
    console.log('sendMessage called with tagId:', tagId, 'content:', content);
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());
    if (!currentUser) {
      console.error('User not authenticated');
      throw new Error('ユーザーが認証されていません');
    }

    // メンションされたユーザーを抽出（非同期処理を待つ）
    console.log('メンション抽出を開始します');
    const { mentions, formattedContent } = await this.extractMentions(content, tagId);
    console.log('抽出されたメンション:', mentions);

    const message: Omit<Message, 'id'> = {
      tagId,
      senderEmail: currentUser.email || '',
      senderName: currentUser.displayName || '匿名',
      content: formattedContent,
      createdAt: new Date(),
      attachments,
      mentions: mentions
    };

    console.log('作成するメッセージ:', message);
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const docRef = await addDoc(messagesRef, {
        ...message,
        createdAt: Timestamp.fromDate(message.createdAt)
      });

      console.log('メッセージを作成しました。ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('メッセージの保存中にエラーが発生しました:', error);
      throw error;
    }
  }

  // 返信メッセージを送信する
  async sendReplyMessage(tagId: string, content: string, replyToId: string, replyToName: string): Promise<string> {
    console.log('sendReplyMessage called with tagId:', tagId, 'content:', content);
    const currentUser = await firstValueFrom(this.authService.getCurrentUser());
    if (!currentUser) {
      console.error('User not authenticated');
      throw new Error('ユーザーが認証されていません');
    }

    // メンションされたユーザーを抽出（非同期処理を待つ）
    console.log('返信メッセージのメンション抽出を開始します');
    const { mentions, formattedContent } = await this.extractMentions(content, tagId);
    console.log('抽出されたメンション:', mentions);

    const message: Omit<Message, 'id'> = {
      tagId,
      senderEmail: currentUser.email || '',
      senderName: currentUser.displayName || '匿名',
      content: formattedContent,
      createdAt: new Date(),
      replyTo: replyToId,
      replyToName: replyToName,
      mentions: mentions
    };

    console.log('作成する返信メッセージ:', message);
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const docRef = await addDoc(messagesRef, {
        ...message,
        createdAt: Timestamp.fromDate(message.createdAt)
      });

      console.log('返信メッセージを作成しました。ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('返信メッセージの保存中にエラーが発生しました:', error);
      throw error;
    }
  }

  // メッセージを更新する
  async updateMessage(messageId: string, content: string): Promise<void> {
    const messageRef = doc(this.firestore, 'messages', messageId);
    await updateDoc(messageRef, {
      content,
      updatedAt: Timestamp.fromDate(new Date())
    });
  }

  // メッセージを削除する
  async deleteMessage(messageId: string): Promise<void> {
    const messageRef = doc(this.firestore, 'messages', messageId);
    await deleteDoc(messageRef);
  }

  // メッセージを既読にする
  async markAsRead(messageId: string): Promise<void> {
    const messageRef = doc(this.firestore, 'messages', messageId);
    await updateDoc(messageRef, {
      isRead: true
    });
  }
} 